import { apiRequest } from './api.client';
import type { ApiResponse } from '../types';

export interface GlobalPlan {
    id: string;
    name: string;
    price: number;
    student_limit: number;
    features: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export async function getGlobalPlans(): Promise<ApiResponse<GlobalPlan[]>> {
    return apiRequest<GlobalPlan[]>('/api/v1/global-plans');
}

export async function createGlobalPlan(data: Partial<GlobalPlan>): Promise<ApiResponse<GlobalPlan>> {
    return apiRequest<GlobalPlan>('/api/v1/global-plans', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function updateGlobalPlan(id: string, data: Partial<GlobalPlan>): Promise<ApiResponse<GlobalPlan>> {
    return apiRequest<GlobalPlan>(`/api/v1/global-plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function deleteGlobalPlan(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/v1/global-plans/${id}`, {
        method: 'DELETE'
    });
}
