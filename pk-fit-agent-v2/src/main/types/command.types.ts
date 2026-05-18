export interface AccessCommand {
    id: string;
    command_type: string;
    academy_id: string;
    turnstile_config_id?: string;
    user_id?: string;
    payload?: CommandPayload;
    status: 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED';
    created_at: string;
    completed_at?: string;
    error_message?: string;
}

export interface CommandPayload {
    user_id?: string;
    user_name?: string;
    user_photo_url?: string;
    manual?: boolean;
    cpf?: string;
    card_number?: string;
}

export interface SyncFaceCommand extends AccessCommand {
    payload: {
        user_id: string;
        user_name: string;
        user_photo_url: string;
    };
}

export type CommandType = 'GRANT_ACCESS' | 'DENY_ACCESS' | 'SYNC_USERS' | 'SYNC_FACE' | 'REBOOT';