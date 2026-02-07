import { supabase } from './supabase';
import { getCurrentUser } from './auth.service';
import type { User, ApiResponse } from '../types';

export interface AcademyMember extends User {
    professor_name?: string;
    professor_id?: string;
    student_count?: number;
}

export interface CreateMemberData {
    name: string;
    email: string;
    phone?: string;
    role: 'PROFESSOR' | 'ALUNO';
    academy_id: string;
    professor_id?: string; // For students, the assigned professor
}

// Get the current user's academy ID from persistent storage
export function getCurrentAcademyId(): string | null {
    const user = getCurrentUser();
    return user?.academy_id || null;
}

// Get all members of an academy by role
export async function getAcademyMembers(
    academyId: string,
    role: 'PROFESSOR' | 'ALUNO'
): Promise<ApiResponse<AcademyMember[]>> {
    try {
        // Get user IDs linked to this academy
        const { data: academyUsers, error: auError } = await supabase
            .from('academy_users')
            .select('user_id')
            .eq('academy_id', academyId);

        if (auError) throw auError;

        if (!academyUsers || academyUsers.length === 0) {
            return { success: true, data: [] };
        }

        const userIds = academyUsers.map(au => au.user_id);

        // Get users with the specified role
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*')
            .in('id', userIds)
            .eq('role', role)
            .order('name', { ascending: true });

        if (usersError) throw usersError;

        // For professors, get student count
        // For students, get professor name
        const membersWithDetails: AcademyMember[] = [];

        for (const user of users || []) {
            if (role === 'PROFESSOR') {
                // Count students assigned to this professor
                const { count } = await supabase
                    .from('professor_students')
                    .select('*', { count: 'exact', head: true })
                    .eq('professor_id', user.id);

                membersWithDetails.push({
                    ...user,
                    student_count: count || 0
                });
            } else {
                // Get professor for this student
                const { data: relation } = await supabase
                    .from('professor_students')
                    .select('professor_id, users!professor_students_professor_id_fkey(name)')
                    .eq('student_id', user.id)
                    .single();

                membersWithDetails.push({
                    ...user,
                    professor_id: relation?.professor_id,
                    professor_name: Array.isArray(relation?.users)
                        ? (relation.users[0] as { name: string } | undefined)?.name
                        : (relation?.users as { name: string } | undefined)?.name
                });
            }
        }

        return {
            success: true,
            data: membersWithDetails
        };
    } catch (error) {
        console.error('Error fetching academy members:', error);
        return {
            success: false,
            error: 'Erro ao buscar membros'
        };
    }
}

// Get professors for dropdown
export async function getAcademyProfessors(academyId: string): Promise<ApiResponse<User[]>> {
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
            .in('id', userIds)
            .eq('role', 'PROFESSOR')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        return {
            success: true,
            data: data as User[]
        };
    } catch (error) {
        console.error('Error fetching professors:', error);
        return {
            success: false,
            error: 'Erro ao buscar professores'
        };
    }
}

// Create a new academy member (professor or student)
export async function createAcademyMember(data: CreateMemberData): Promise<ApiResponse<User>> {
    try {
        console.log('Creating member with data:', data);

        // 1. Create the user
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                name: data.name,
                email: data.email.toLowerCase(),
                phone: data.phone || null,
                role: data.role,
                is_active: true
            })
            .select()
            .single();

        if (userError) {
            console.error('Error creating user:', userError);
            if (userError.code === '23505') {
                return {
                    success: false,
                    error: 'Este email já está cadastrado'
                };
            }
            return {
                success: false,
                error: `Erro ao criar usuário: ${userError.message}`
            };
        }

        console.log('User created:', user.id);

        // 2. Link user to academy
        const { error: linkError } = await supabase
            .from('academy_users')
            .insert({
                academy_id: data.academy_id,
                user_id: user.id
            });

        if (linkError) {
            console.error('Error linking user to academy:', linkError);
            // Cleanup: delete the created user
            await supabase.from('users').delete().eq('id', user.id);
            return {
                success: false,
                error: `Erro ao vincular à academia: ${linkError.message}`
            };
        }

        console.log('User linked to academy');

        // 3. If student and professor_id provided, create the relationship
        if (data.role === 'ALUNO' && data.professor_id) {
            const { error: profError } = await supabase
                .from('professor_students')
                .insert({
                    professor_id: data.professor_id,
                    student_id: user.id
                });

            if (profError) {
                console.error('Error linking student to professor:', profError);
                // Don't fail the whole operation, just log the error
            } else {
                console.log('Student linked to professor');
            }
        }

        return {
            success: true,
            data: user as User
        };
    } catch (error) {
        console.error('Error creating member:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return {
            success: false,
            error: `Erro ao criar membro: ${errorMessage}`
        };
    }
}

// Update academy member
export async function updateAcademyMember(
    id: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'phone' | 'is_active'>>,
    newProfessorId?: string
): Promise<ApiResponse<User>> {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update professor relationship if provided
        if (newProfessorId !== undefined) {
            // Remove existing relationship
            await supabase
                .from('professor_students')
                .delete()
                .eq('student_id', id);

            // Create new relationship if professor specified
            if (newProfessorId) {
                await supabase
                    .from('professor_students')
                    .insert({
                        professor_id: newProfessorId,
                        student_id: id
                    });
            }
        }

        return {
            success: true,
            data: data as User
        };
    } catch (error) {
        console.error('Error updating member:', error);
        return {
            success: false,
            error: 'Erro ao atualizar membro'
        };
    }
}

// Toggle member active status
export async function toggleMemberStatus(id: string, isActive: boolean): Promise<ApiResponse<User>> {
    return updateAcademyMember(id, { is_active: isActive });
}

// Delete academy member
export async function deleteAcademyMember(id: string): Promise<ApiResponse<void>> {
    try {
        // Fetch email before delete (needed for auth cleanup)
        const { data: user } = await supabase
            .from('users')
            .select('email')
            .eq('id', id)
            .single();

        // Academy_users and professor_students will cascade delete
        const { error, count } = await supabase
            .from('users')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) throw error;

        if (count === 0) {
            return {
                success: false,
                error: 'Usuário não encontrado ou permissão negada para exclusão.'
            };
        }

        // Delete from auth.users using RPC
        if (user && user.email) {
            await supabase.rpc('delete_user_by_email', { email_arg: user.email });
        }

        return {
            success: true,
            data: undefined
        };
    } catch (error) {
        console.error('Error deleting member:', error);
        return {
            success: false,
            error: 'Erro ao excluir membro'
        };
    }
}
