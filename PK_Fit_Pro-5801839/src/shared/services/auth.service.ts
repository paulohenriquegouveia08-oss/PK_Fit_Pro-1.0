import { supabase } from './supabase';
import {
    setStorageItem,
    getStorageItem,
    removeStorageItem,
    clearUserData,
    STORAGE_KEYS,
    EXPIRATION
} from './storage.service';
import type { User, ApiResponse } from '../types';

// Check if email exists in the system and if access is allowed
export async function checkEmail(email: string): Promise<ApiResponse<{ exists: boolean; hasPassword: boolean; isBlocked?: boolean; blockReason?: string }>> {
    try {
        // Fetch user basic info
        const { data: user, error } = await supabase
            .from('users')
            .select('id, password_hash, is_active')
            .eq('email', email.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!user) {
            return {
                success: true,
                data: { exists: false, hasPassword: false }
            };
        }

        // Check if user is active
        if (user.is_active === false) {
            return {
                success: true,
                data: {
                    exists: true,
                    hasPassword: !!user.password_hash,
                    isBlocked: true,
                    blockReason: 'Sua conta está desativada. Entre em contato com o suporte.'
                }
            };
        }

        // Check if user's academy is active (if applicable)
        const { data: academyUser } = await supabase
            .from('academy_users')
            .select('academies(status)')
            .eq('user_id', user.id)
            .single();

        const academyStatus = academyUser?.academies
            ? (Array.isArray(academyUser.academies)
                ? academyUser.academies[0]?.status
                : (academyUser.academies as any)?.status)
            : null;

        if (academyStatus === 'INACTIVE' || academyStatus === 'SUSPENDED') {
            return {
                success: true,
                data: {
                    exists: true,
                    hasPassword: !!user.password_hash,
                    isBlocked: true,
                    blockReason: 'Sua academia está suspensa ou inativa.'
                }
            };
        }

        return {
            success: true,
            data: {
                exists: true,
                hasPassword: !!user.password_hash,
                isBlocked: false
            }
        };
    } catch (error) {
        console.error('Error checking email:', error);
        return {
            success: false,
            error: 'Erro ao verificar email'
        };
    }
}

// Create password for user (first-time login)
export async function createPassword(
    email: string,
    password: string
): Promise<ApiResponse<User>> {
    try {
        // Import bcryptjs for password hashing
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('email', email.toLowerCase())
            .select()
            .single();

        if (error) throw error;

        // Fetch academy_id for the user
        let academyId: string | null = null;
        const { data: academyUser } = await supabase
            .from('academy_users')
            .select('academy_id')
            .eq('user_id', data.id)
            .single();

        if (academyUser) {
            academyId = academyUser.academy_id;
        }

        // Remove password_hash and store user in persistent storage
        const { password_hash, ...safeUser } = data;
        const userWithAcademy = { ...safeUser, academy_id: academyId };

        // Store in localStorage with 7 days expiration
        setStorageItem(
            STORAGE_KEYS.USER_SESSION,
            userWithAcademy,
            EXPIRATION.SESSION_MINUTES,
            userWithAcademy.id
        );

        return {
            success: true,
            data: userWithAcademy as User
        };
    } catch (error) {
        console.error('Error creating password:', error);
        return {
            success: false,
            error: 'Erro ao criar senha'
        };
    }
}

// Login with email and password
export async function login(
    email: string,
    password: string
): Promise<ApiResponse<User>> {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !user) {
            return {
                success: false,
                error: 'Email não encontrado'
            };
        }

        if (!user.password_hash) {
            return {
                success: false,
                error: 'Usuário não possui senha cadastrada'
            };
        }

        // Import bcryptjs for password comparison
        const bcrypt = await import('bcryptjs');
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return {
                success: false,
                error: 'Senha incorreta'
            };
        }

        if (!user.is_active) {
            return {
                success: false,
                error: 'Usuário desativado'
            };
        }

        // Fetch academy_id for the user
        let academyId: string | null = null;
        const { data: academyUser } = await supabase
            .from('academy_users')
            .select('academy_id')
            .eq('user_id', user.id)
            .single();

        if (academyUser) {
            academyId = academyUser.academy_id;
        }

        // Store user in persistent storage (remove password_hash, add academy_id)
        const { password_hash, ...safeUser } = user;
        const userWithAcademy = { ...safeUser, academy_id: academyId };

        // Store in localStorage with 7 days expiration
        setStorageItem(
            STORAGE_KEYS.USER_SESSION,
            userWithAcademy,
            EXPIRATION.SESSION_MINUTES,
            userWithAcademy.id
        );

        return {
            success: true,
            data: userWithAcademy as User
        };
    } catch (error) {
        console.error('Error logging in:', error);
        return {
            success: false,
            error: 'Erro ao fazer login'
        };
    }
}

// Get current user from persistent storage
export function getCurrentUser(): User | null {
    try {
        const user = getStorageItem<User>(STORAGE_KEYS.USER_SESSION);
        return user;
    } catch {
        return null;
    }
}

// Logout - clear session and all user data including workout cache
export function logout(): void {
    const user = getCurrentUser();
    if (user?.id) {
        clearUserData(user.id);
    }
    removeStorageItem(STORAGE_KEYS.USER_SESSION);
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return getCurrentUser() !== null;
}

