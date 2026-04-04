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
 */
export async function subscribeToPush(): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        if (!VAPID_PUBLIC_KEY) {
            console.warn('VAPID public key not configured');
            return false;
        }

        // Make sure notification permission is granted
        if (Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') return false;
        } else if (Notification.permission !== 'granted') {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
            });
        }

        // Extract keys
        const subJSON = subscription.toJSON();
        const endpoint = subJSON.endpoint!;
        const p256dh = subJSON.keys!.p256dh!;
        const auth = subJSON.keys!.auth!;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Upsert to Supabase (idempotent)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint,
                p256dh,
                auth
            }, {
                onConflict: 'user_id,endpoint'
            });

        if (error) {
            console.error('Failed to save push subscription:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Push subscription failed:', err);
        return false;
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
