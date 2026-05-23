import { apiRequest } from './api.client';
import type { ApiResponse } from '../types';

export interface ValidateInviteResult {
    valid: boolean;
    type: 'academy_invite' | 'teacher_invite' | 'student_invite' | null;
    expires_at: string | null;
    remaining_uses: number;
    metadata: any;
    reason?: string;
}

export async function validateInviteCode(code: string): Promise<ApiResponse<ValidateInviteResult>> {
    return apiRequest<ValidateInviteResult>('/api/v1/invites/validate', {
        method: 'POST',
        body: JSON.stringify({ code })
    });
}

export async function redeemInviteCode(payload: any): Promise<ApiResponse<{ user_id: string; role: string }>> {
    return apiRequest<{ user_id: string; role: string }>('/api/v1/invites/redeem', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}
