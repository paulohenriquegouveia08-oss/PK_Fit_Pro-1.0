import { supabase } from './supabase';
import { getCurrentAcademyId } from './academyMember.service';

export interface FaceSyncCommand {
    userId: string;
    userName: string;
    userPhotoUrl: string;
}

export async function createFaceSyncCommand(
    userId: string,
    userName: string,
    userPhotoUrl: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const academyId = getCurrentAcademyId();
        
        if (!academyId) {
            return { success: false, error: 'Academia não identificada' };
        }

        const { error } = await supabase
            .from('access_commands')
            .insert({
                command_type: 'SYNC_FACE',
                academy_id: academyId,
                user_id: userId,
                payload: {
                    user_id: userId,
                    user_name: userName,
                    user_photo_url: userPhotoUrl
                },
                status: 'PENDING'
            });

        if (error) {
            console.error('Error creating SYNC_FACE command:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in createFaceSyncCommand:', error);
        return { success: false, error: 'Erro ao criar comando de sincronização' };
    }
}

export async function triggerFaceSyncForUser(
    userId: string,
    userName: string,
    userPhotoUrl: string
): Promise<boolean> {
    if (!userPhotoUrl) {
        console.log('User has no photo, skipping face sync');
        return false;
    }

    const result = await createFaceSyncCommand(userId, userName, userPhotoUrl);
    
    if (result.success) {
        console.log(`SYNC_FACE command created for user ${userName}`);
    } else {
        console.error(`Failed to create SYNC_FACE command: ${result.error}`);
    }

    return result.success;
}

export async function getFaceSyncStatus(userId: string): Promise<{
    status: string;
    lastAttempt?: string;
    errorMessage?: string;
} | null> {
    try {
        const { data, error } = await supabase
            .from('access_commands')
            .select('status, created_at, error_message')
            .eq('command_type', 'SYNC_FACE')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            status: data.status,
            lastAttempt: data.created_at,
            errorMessage: data.error_message
        };
    } catch (error) {
        console.error('Error getting face sync status:', error);
        return null;
    }
}

export async function checkAndSyncFace(userId: string): Promise<boolean> {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('name, photo_url')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return false;
        }

        if (!user.photo_url) {
            console.log('User has no photo, skipping face sync');
            return false;
        }

        return await triggerFaceSyncForUser(userId, user.name, user.photo_url);
    } catch (error) {
        console.error('Error checking and syncing face:', error);
        return false;
    }
}