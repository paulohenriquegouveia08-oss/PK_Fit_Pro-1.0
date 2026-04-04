// Netlify Function: Process pending push notifications
// Called by Supabase pg_cron every 30 seconds via pg_net
// 
// Required env vars on Netlify:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import webpush from 'web-push';

export default async function handler(req) {
    // Allow both GET (from pg_net) and POST
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:pkfitpro@app.com';

    if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
        return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

    try {
        // 1. Fetch pending pushes that are due
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
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }

        let sentCount = 0;
        const sentIds = [];

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
                    console.error(`Push failed for ${sub.endpoint}:`, err.message);
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

        // 3. Mark as sent / delete sent pushes
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

        return new Response(JSON.stringify({ sent: sentCount, processed: sentIds.length }), { status: 200 });
    } catch (err) {
        console.error('Send push error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/send-push'
};
