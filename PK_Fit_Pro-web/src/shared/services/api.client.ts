import { supabase } from './supabase';

let CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:3001';

if (import.meta.env.PROD) {
    CORE_API_URL = window.location.origin + '/proxy/core';
}

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
      ...(options.headers as Record<string, string> || {}),
    };

    // Only set Content-Type for requests that have a body
    if (options.body) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Ensure no double slashes in URL (Vercel redirects double slashes which breaks CORS preflight)
    const baseUrl = CORE_API_URL.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    const response = await fetch(`${baseUrl}${cleanPath}`, {
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
