import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Convert URL-safe base64 to Uint8Array (needed by PushManager.subscribe) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Subscribe the current browser/device to receive Web Push notifications.
 * Stores the subscription in Supabase for later use.
 * Returns { ok: boolean, step: string, error?: string } for diagnostics.
 */
export async function subscribeToPush(): Promise<{ ok: boolean; step: string; error?: string }> {
    try {
        // Step 1: Check browser support
        if (!('serviceWorker' in navigator)) {
            return { ok: false, step: 'support', error: 'Service Worker not supported' };
        }
        if (!('PushManager' in window)) {
            return { ok: false, step: 'support', error: 'PushManager not supported' };
        }
        if (!VAPID_PUBLIC_KEY) {
            return { ok: false, step: 'config', error: 'VAPID key not configured' };
        }

        // Step 2: Check/request notification permission
        if (Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') {
                return { ok: false, step: 'permission', error: `Permission ${result}` };
            }
        } else if (Notification.permission !== 'granted') {
            return { ok: false, step: 'permission', error: `Permission is ${Notification.permission}` };
        }

        // Step 3: Wait for Service Worker to be ready
        const registration = await navigator.serviceWorker.ready;
        if (!registration) {
            return { ok: false, step: 'sw_ready', error: 'Service Worker registration is null' };
        }

        // Step 4: Get or create push subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
                });
            } catch (subErr: any) {
                return { ok: false, step: 'push_subscribe', error: subErr?.message || String(subErr) };
            }
        }

        if (!subscription) {
            return { ok: false, step: 'push_subscribe', error: 'Subscription is null after subscribe' };
        }

        // Step 5: Extract keys from subscription
        const subJSON = subscription.toJSON();
        if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
            return { ok: false, step: 'extract_keys', error: `Missing keys: endpoint=${!!subJSON.endpoint} p256dh=${!!subJSON.keys?.p256dh} auth=${!!subJSON.keys?.auth}` };
        }

        // Step 6: Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { ok: false, step: 'auth', error: 'No authenticated user found' };
        }

        // Step 7: Save subscription to Supabase
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: subJSON.endpoint,
                p256dh: subJSON.keys.p256dh,
                auth: subJSON.keys.auth
            }, {
                onConflict: 'user_id,endpoint'
            });

        if (error) {
            return { ok: false, step: 'db_save', error: `${error.code}: ${error.message}` };
        }

        return { ok: true, step: 'complete' };
    } catch (err: any) {
        return { ok: false, step: 'unknown', error: err?.message || String(err) };
    }
}

/**
 * Schedule a push notification to be sent at a specific time (when rest ends).
 */
export async function schedulePushNotification(
    delaySeconds: number,
    title = '🔔 Descanso Finalizado!',
    body = 'Hora de voltar para a próxima série! 💪'
): Promise<string | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const sendAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

        const { data, error } = await supabase
            .from('pending_push')
            .insert({
                user_id: user.id,
                send_at: sendAt,
                title,
                body
            })
            .select('id')
            .single();

        if (error) {
            console.error('Failed to schedule push:', error);
            return null;
        }

        return data?.id || null;
    } catch (err) {
        console.error('Schedule push failed:', err);
        return null;
    }
}

/**
 * Cancel a pending push notification (e.g. when user skips rest).
 */
export async function cancelPendingPush(pushId: string): Promise<void> {
    try {
        await supabase.from('pending_push').delete().eq('id', pushId);
    } catch (_err) {
        // Silently fail — it's okay if the push was already sent
    }
}
