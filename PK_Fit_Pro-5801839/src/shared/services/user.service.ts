import { supabase } from './supabase';
import type { User, ApiResponse, UserRole } from '../types';

export interface UserWithAcademy extends User {
    academy_name?: string;
    academy_id?: string;
}

export interface CreateUserData {
    name: string;
    email: string;
    role: UserRole;
    academy_id?: string;
}

// Get all users (optionally filtered by role)
export async function getUsers(role?: UserRole): Promise<ApiResponse<UserWithAcademy[]>> {
    try {
        let query = supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (role) {
            query = query.eq('role', role);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Get academy associations for each user
        const usersWithAcademy: UserWithAcademy[] = [];

        for (const user of data || []) {
            const { data: academyUser } = await supabase
                .from('academy_users')
                .select('academy_id, academies(name)')
                .eq('user_id', user.id)
                .single();

            usersWithAcademy.push({
                ...user,
                academy_id: academyUser?.academy_id,
                academy_name: Array.isArray(academyUser?.academies)
                    ? (academyUser.academies[0] as { name: string } | undefined)?.name
                    : (academyUser?.academies as { name: string } | undefined)?.name
            });
        }

        return {
            success: true,
            data: usersWithAcademy
        };
    } catch (error) {
        console.error('Error fetching users:', error);
        return {
            success: false,
            error: 'Erro ao buscar usuários'
        };
    }
}

// Get users by academy
export async function getUsersByAcademy(academyId: string): Promise<ApiResponse<User[]>> {
    try {
        const { data: academyUsers, error: auError } = await supabase
            .from('academy_users')
            .select('user_id')
            .eq('academy_id', academyId);

        if (auError) throw auError;

        if (!academyUsers || academyUsers.length === 0) {
            return { success: true, data: [] };
        }

        const userIds = academyUsers.map(au => au.user_id);

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .in('id', userIds);

        if (error) throw error;

        return {
            success: true,
            data: data as User[]
        };
    } catch (error) {
        console.error('Error fetching users by academy:', error);
        return {
            success: false,
            error: 'Erro ao buscar usuários da academia'
        };
    }
}

// Create user
export async function createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    try {
        const TEMP_PASSWORD = 'Mud@r123';
        const { data: authId, error: authError } = await supabase.rpc(
            'create_auth_user_admin',
            {
                raw_email: userData.email.toLowerCase(),
                raw_password: TEMP_PASSWORD,
                raw_name: userData.name,
                raw_role: userData.role
            }
        );

        if (authError) {
            console.error('Error creating user via RPC:', authError);
            return {
                success: false,
                error: `Erro ao criar usuário: O email já existe ou sem permissão.`
            };
        }

        // Wait a brief moment for PostgreSQL Trigger (on_auth_user_created)
        await new Promise(resolve => setTimeout(resolve, 300));

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authId)
            .single();

        if (userError || !user) {
            return {
                success: false,
                error: 'Usuário criado, mas não sincronizado. Tente atualizar a página.'
            };
        }

        // If academy_id is provided, link user to academy
        if (userData.academy_id) {
            const { error: linkError } = await supabase
                .from('academy_users')
                .insert({
                    academy_id: userData.academy_id,
                    user_id: user.id
                });

            if (linkError) throw linkError;
        }

        return {
            success: true,
            data: user as User
        };
    } catch (error) {
        console.error('Error creating user:', error);
        return {
            success: false,
            error: 'Erro ao criar usuário'
        };
    }
}

// Update user
export async function updateUser(
    id: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'phone' | 'is_active'>>
): Promise<ApiResponse<User>> {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as User
        };
    } catch (error) {
        console.error('Error updating user:', error);
        return {
            success: false,
            error: 'Erro ao atualizar usuário'
        };
    }
}

// Toggle user active status
export async function toggleUserStatus(id: string, isActive: boolean): Promise<ApiResponse<User>> {
    return updateUser(id, { is_active: isActive });
}

// Delete user
export async function deleteUser(id: string): Promise<ApiResponse<void>> {
    try {
        // Fetch email before delete (needed for auth cleanup)
        const { data: user } = await supabase
            .from('users')
            .select('email')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Delete from auth.users using RPC
        if (user && user.email) {
            await supabase.rpc('delete_user_by_email', { email_arg: user.email });
        }

        return {
            success: true,
            data: undefined
        };
    } catch (error) {
        console.error('Error deleting user:', error);
        return {
            success: false,
            error: 'Erro ao excluir usuário'
        };
    }
}

// Get user by ID
export async function getUserById(id: string): Promise<ApiResponse<User>> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as User
        };
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return {
            success: false,
            error: 'Erro ao buscar usuário'
        };
    }
}
