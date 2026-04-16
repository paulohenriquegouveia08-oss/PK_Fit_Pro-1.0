// Vercel Serverless Function: Health check + push notification processor
// Called by Supabase pg_cron via pg_net to keep the database active
// and process any pending push notifications.
// Always returns 200 OK so pg_cron never disables the job.
//
// Required env vars (set in Vercel Dashboard):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL

import webpush from 'web-push';

export default async function handler(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:pkfitpro@app.com';

    // Always return 200 — even on error. This prevents pg_cron from disabling the job.
    const ok = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), ...data });
    };

    if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
        return ok({ pushes_sent: 0, note: 'env vars missing' });
    }

    try {
        webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

        // Fetch pending pushes
        const pendingRes = await fetch(
            `${SUPABASE_URL}/rest/v1/pending_push?sent=eq.false&send_at=lte.${new Date().toISOString()}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const pendingPushes = await pendingRes.json();

        if (!Array.isArray(pendingPushes) || pendingPushes.length === 0) {
            return ok({ pushes_sent: 0 });
        }

        let sentCount = 0;
        const sentIds = [];

        for (const push of pendingPushes) {
            const subRes = await fetch(
                `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${push.user_id}&select=*`,
                {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const subscriptions = await subRes.json();
            if (!Array.isArray(subscriptions)) { sentIds.push(push.id); continue; }

            for (const sub of subscriptions) {
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({
                            title: push.title,
                            body: push.body,
                            icon: '/favicon.jpg',
                            vibrate: [300, 200, 300, 200, 300],
                            actions: [{ action: 'open', title: '💪 Voltar ao Treino' }]
                        })
                    );
                    sentCount++;
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
                            method: 'DELETE',
                            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                        });
                    }
                }
            }
            sentIds.push(push.id);
        }

        if (sentIds.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/pending_push?id=in.(${sentIds.join(',')})`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
        }

        return ok({ pushes_sent: sentCount, processed: sentIds.length });
    } catch (err) {
        // Always return 200 even on error
        return ok({ pushes_sent: 0, error: err.message });
    }
}
