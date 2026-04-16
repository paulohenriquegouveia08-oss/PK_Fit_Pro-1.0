// Vercel Serverless Function: Process pending push notifications
// Called by Supabase pg_cron every 30 seconds via pg_net
// Also called directly by the frontend setTimeout (fast-path)
//
// Required env vars (set in Vercel Dashboard):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

    // Debug: show which env vars are present
    const envStatus = {
        SUPABASE_URL: !!SUPABASE_URL,
        SUPABASE_KEY: !!SUPABASE_KEY,
        VAPID_PUBLIC: !!VAPID_PUBLIC,
        VAPID_PRIVATE: !!VAPID_PRIVATE,
        VAPID_EMAIL: VAPID_EMAIL
    };

    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(500).json({ error: 'Missing env vars', envStatus });
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    try {
        // 1. Fetch pending pushes that are due
        const pendingUrl = `${SUPABASE_URL}/rest/v1/pending_push?sent=eq.false&send_at=lte.${new Date().toISOString()}&select=*`;
        const pendingRes = await fetch(pendingUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!pendingRes.ok) {
            const errText = await pendingRes.text();
            Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
            return res.status(500).json({ error: 'Failed to fetch pending pushes', status: pendingRes.status, detail: errText });
        }

        const pendingPushes = await pendingRes.json();

        if (!Array.isArray(pendingPushes) || pendingPushes.length === 0) {
            Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
            return res.status(200).json({ sent: 0, pending: 0, message: 'No pending pushes found' });
        }

        let sentCount = 0;
        const sentIds = [];
        const errors = [];

        for (const push of pendingPushes) {
            // 2. Get subscriptions for this user
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

            if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
                errors.push({ push_id: push.id, error: 'No subscriptions found for user', user_id: push.user_id });
                sentIds.push(push.id); // Still delete the pending push to avoid infinite retries
                continue;
            }

            for (const sub of subscriptions) {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                const payload = JSON.stringify({
                    title: push.title,
                    body: push.body,
                    icon: '/favicon.jpg',
                    vibrate: [300, 200, 300, 200, 300],
                    actions: [{ action: 'open', title: '💪 Voltar ao Treino' }]
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    sentCount++;
                } catch (err) {
                    errors.push({ push_id: push.id, endpoint: sub.endpoint, error: err.message, statusCode: err.statusCode });
                    // If subscription is expired/invalid (410 Gone), remove it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await fetch(
                            `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    'apikey': SUPABASE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_KEY}`
                                }
                            }
                        );
                    }
                }
            }

            sentIds.push(push.id);
        }

        // 3. Delete processed pushes
        if (sentIds.length > 0) {
            await fetch(
                `${SUPABASE_URL}/rest/v1/pending_push?id=in.(${sentIds.join(',')})`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                }
            );
        }

        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(200).json({
            sent: sentCount,
            processed: sentIds.length,
            pending_found: pendingPushes.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(500).json({ error: err.message, stack: err.stack });
    }
}
