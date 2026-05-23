export interface ControlIdUser {
    id: number;
    name: string;
    registration?: string;
    cpf?: string;
    photo_url?: string;
}

export interface FaceSyncStatus {
    userId: string;
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'RETRYING';
    errorMessage?: string;
    attempts: number;
    lastAttempt?: Date;
    createdAt: Date;
}

export interface FaceSyncResult {
    success: boolean;
    userId: string;
    message: string;
    errorCode?: string;
}