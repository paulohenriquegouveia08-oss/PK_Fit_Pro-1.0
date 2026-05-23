import { supabase } from './supabase';

const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:3001';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Standard fetch wrapper to make calls to the Core API.
 * Automatically injects the Supabase JWT token and content types.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Attempt to get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${CORE_API_URL}${path}`, {
      ...options,
      headers,
    });

    // Check if the response matches our standard JSON structure
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      // If the API returns a standard ApiResponse shape (success/data/error), pass it through
      if ('success' in data) {
          return data;
      }
      
      return {
          success: response.ok,
          data: response.ok ? data : undefined,
          error: !response.ok ? 'Failed request' : undefined
      }
    }

    if (!response.ok) {
      return { success: false, error: `HTTP Error: ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[API Client] Error calling ${path}:`, err);
    return { success: false, error: err?.message || 'Erro de rede' };
  }
}
