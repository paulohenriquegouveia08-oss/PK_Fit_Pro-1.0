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
import { apiRequest } from './api.client';

const USE_CORE_API = import.meta.env.VITE_USE_CORE_API === 'true';

// Check if email exists in the system and if access is allowed
export async function checkEmail(email: string): Promise<ApiResponse<{ exists: boolean; hasPassword: boolean; isBlocked?: boolean; blockReason?: string }>> {
    if (USE_CORE_API) {
        const res = await apiRequest<{ exists: boolean; needsPasswordSetup?: boolean; is_active?: boolean }>('/api/v1/auth/check-email', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        if (!res.success) return { success: false, error: res.error };
        if (!res.data?.exists) return { success: true, data: { exists: false, hasPassword: false } };
        
        if (res.data.is_active === false) {
            return {
                success: true,
                data: { exists: true, hasPassword: !res.data.needsPasswordSetup, isBlocked: true, blockReason: 'Sua conta está desativada. Entre em contato com o suporte.' }
            };
        }
        
        return {
            success: true,
            data: { exists: true, hasPassword: !res.data.needsPasswordSetup, isBlocked: false }
        };
    }

    try {
        // Fetch user basic info securely via RPC (bypassing RLS since we removed anon select access)
        const { data: userResult, error } = await supabase
            .rpc('check_user_status_rpc', { lookup_email: email.toLowerCase() });

        if (error) {
            throw error;
        }

        if (!userResult || !userResult.exists) {
            return {
                success: true,
                data: { exists: false, hasPassword: false }
            };
        }

        const user = userResult as any;

        // In the new Supabase Auth flow, all new users or migrated users start with 'Mud@r123'.
        // We test if they still hold this temporary password to prompt a change.
        let hasPassword = false;
        const { error: tempLoginError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: 'Mud@r123'
        });

        if (!tempLoginError) {
            // Successfully logged in with temp password -> needs to create a new one
            hasPassword = false;
            await supabase.auth.signOut(); // Clean up temp session
        } else {
            // Failed to login with temp password -> they already changed it
            hasPassword = true;
        }

        // Check if user is active
        if (user.is_active === false) {
            return {
                success: true,
                data: {
                    exists: true,
                    hasPassword,
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
                    hasPassword,
                    isBlocked: true,
                    blockReason: 'Sua academia está suspensa ou inativa.'
                }
            };
        }

        // Check payment reversal for ALUNO users
        if (user.role === 'ALUNO') {
            const today = new Date().toISOString().split('T')[0];
            const monthStart = today.substring(0, 7) + '-01';

            // Check if there are reversed (cancelado) payments this month
            const { data: cancelledPayments } = await supabase
                .from('payments')
                .select('id')
                .eq('student_id', user.id)
                .eq('status', 'cancelado')
                .gte('payment_date', monthStart)
                .lte('payment_date', today);

            if (cancelledPayments && cancelledPayments.length > 0) {
                // Check if there's a valid paid payment this month
                const { data: paidPayments } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('student_id', user.id)
                    .eq('status', 'pago')
                    .gte('payment_date', monthStart)
                    .lte('payment_date', today);

                if (!paidPayments || paidPayments.length === 0) {
                    return {
                        success: true,
                        data: {
                            exists: true,
                            hasPassword,
                            isBlocked: true,
                            blockReason: '⚠️ Acesso negado por falta de pagamento. Seu pagamento foi estornado. Entre em contato com sua academia para regularizar.'
                        }
                    };
                }
            }
        }

        return {
            success: true,
            data: {
                exists: true,
                hasPassword,
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

// Create password for user (first-time login or password reset)
export async function createPassword(
    email: string,
    password: string
): Promise<ApiResponse<User>> {
    if (USE_CORE_API) {
        const setRes = await apiRequest('/api/v1/auth/set-password', {
            method: 'POST',
            body: JSON.stringify({ email, new_password: password })
        });
        
        if (!setRes.success) return { success: false, error: setRes.error };
        
        // After setting the password, login to fetch profile and set session
        return login(email, password);
    }

    try {
        // Since we migrated to Supabase Auth, setting a password for the first time
        // means we update the user's password in the Auth system.
        // However, if the user doesn't have an active session, they can't update their own password
        // without a recovery token or being logged in.

        // Assuming the admin created the user in auth.users with a default password,
        // we first sign in with that default password ('Mud@r123' as per our migration),
        // or we use the recovery flow in a real app.
        // For backwards compatibility in this flow, we will attempt to login with a known temporary password.

        const TEMP_PASSWORD = 'Mud@r123';
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: TEMP_PASSWORD
        });

        if (signInError) {
            // Se não conseguiu logar com a senha temporária, talvez ele já tenha senha ou erro de credencial
            return { success: false, error: 'Não foi possível validar seu acesso para criar a senha.' };
        }

        // Agora autenticado, atualizamos a senha do usuário
        const { error: updateError } = await supabase.auth.updateUser({
            password: password
        });

        if (updateError) {
            return { success: false, error: 'Erro ao atualizar a senha no sistema.' };
        }

        // Buscar dados do public.users
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
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

        const { password_hash, ...safeUser } = data;
        
        // If name is null in public.users (due to fallback during registration), use the name from auth metadata
        if (!safeUser.name && authData.user.user_metadata?.name) {
            safeUser.name = authData.user.user_metadata.name;
        }

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
            error: 'Erro ao criar senha. Verifique sua conexão.'
        };
    }
}

// Login with email and password
export async function login(
    email: string,
    password: string
): Promise<ApiResponse<User>> {
    if (USE_CORE_API) {
        const res = await apiRequest<{ session: any; user: User }>('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (!res.success) return { success: false, error: res.error };
        
        // Ensure local supabase client is authenticated with the session
        await supabase.auth.setSession({
            access_token: res.data!.session.access_token,
            refresh_token: res.data!.session.refresh_token
        });
        
        const userWithAcademy = res.data!.user;
        
        setStorageItem(
            STORAGE_KEYS.USER_SESSION,
            userWithAcademy,
            EXPIRATION.SESSION_MINUTES,
            userWithAcademy.id
        );
        
        return { success: true, data: userWithAcademy };
    }

    try {
        // 1. Authenticate with Supabase Auth natively
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password,
        });

        if (authError || !authData.user) {
            return {
                success: false,
                error: 'Email ou senha incorretos'
            };
        }

        // 2. Fetch the user profile from our public users table
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (error || !user) {
            // Rollback auth
            await supabase.auth.signOut();
            return {
                success: false,
                error: 'Perfil de usuário não encontrado'
            };
        }

        if (!user.is_active) {
            return {
                success: false,
                error: 'Usuário desativado'
            };
        }

        // Check payment reversal for ALUNO users (double safety)
        if (user.role === 'ALUNO') {
            const today = new Date().toISOString().split('T')[0];
            const monthStart = today.substring(0, 7) + '-01';

            const { data: cancelledPayments } = await supabase
                .from('payments')
                .select('id')
                .eq('student_id', user.id)
                .eq('status', 'cancelado')
                .gte('payment_date', monthStart)
                .lte('payment_date', today);

            if (cancelledPayments && cancelledPayments.length > 0) {
                const { data: paidPayments } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('student_id', user.id)
                    .eq('status', 'pago')
                    .gte('payment_date', monthStart)
                    .lte('payment_date', today);

                if (!paidPayments || paidPayments.length === 0) {
                    return {
                        success: false,
                        error: '⚠️ Acesso negado por falta de pagamento. Seu pagamento foi estornado. Entre em contato com sua academia para regularizar.'
                    };
                }
            }
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
        
        // If name is null in public.users, fallback to auth metadata
        if (!safeUser.name && authData?.user?.user_metadata?.name) {
            safeUser.name = authData.user.user_metadata.name;
        }

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

// Clear local frontend session data without touching Supabase Auth
export function clearLocalSession(): void {
    const user = getCurrentUser();
    if (user?.id) {
        clearUserData(user.id);
    }
    removeStorageItem(STORAGE_KEYS.USER_SESSION);
    sessionStorage.removeItem('welcome_name');
}

// Logout - clear session and all user data including workout cache
export async function logout(): Promise<void> {
    clearLocalSession();
    await supabase.auth.signOut();
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return getCurrentUser() !== null;
}

// Security: Validate if the localStorage session matches the true Supabase DB role
export async function validateSessionConsistency(): Promise<boolean> {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Se não conseguiu obter a sessão do Supabase (offline, recarregando no mobile, etc),
        // confiamos na sessão local. O backend/RLS protegerá os dados caso o token esteja inválido.
        if (sessionError || !session) {
            return true;
        }

        const { data, error } = await supabase
            .from('users')
            .select('role, is_active')
            .eq('id', session.user.id)
            .single();

        if (error) {
            // Se for erro de rede/conexão, não desloga o usuário
            if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
                return true; 
            }
            // Se for outro erro, assume que o usuário não existe mais
            return false;
        }
        
        if (!data) return false;
        
        if (data.is_active === false) return false;

        // Se o cargo manipulado no localStorage for diferente do DB real
        if (data.role !== user.role) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

