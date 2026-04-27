import { supabase } from './supabase';
import type { ApiResponse } from '../types';

// ==========================================
// DEFINIÇÃO DE TIPOS
// ==========================================

// Define a estrutura de dados de uma Academia
export interface Academy {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    plan_name: string | null;
    plan_value: number | null;
    payment_status: 'PENDING' | 'PAID' | 'OVERDUE';
    payment_due_date: string | null;
    created_at: string;
    updated_at: string;
}

// Define os dados necessários para criar uma nova academia
export interface CreateAcademyData {
    name: string;
    email: string; // Agora obrigatório e usado também para o usuário
    phone?: string;
    address?: string;
    plan_name?: string;
    plan_value?: number;
    responsible_name: string;
    // responsible_email removido - usa o email da academia
}

// ==========================================
// FUNÇÕES DE LEITURA (GET)
// ==========================================

/**
 * Busca todas as academias cadastradas no sistema.
 * @returns Lista de academias ordenadas pela data de criação (mais recentes primeiro).
 */
export async function getAcademies(): Promise<ApiResponse<Academy[]>> {
    try {
        const { data, error } = await supabase
            .from('academies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return {
            success: true,
            data: data as Academy[]
        };
    } catch (error) {
        console.error('Error fetching academies:', error);
        return {
            success: false,
            error: 'Erro ao buscar academias'
        };
    }
}

/**
 * Busca uma academia específica pelo seu ID.
 * @param id O ID único da academia.
 * @returns Os dados da academia encontrada.
 */
export async function getAcademyById(id: string): Promise<ApiResponse<Academy>> {
    try {
        const { data, error } = await supabase
            .from('academies')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as Academy
        };
    } catch (error) {
        console.error('Error fetching academy:', error);
        return {
            success: false,
            error: 'Erro ao buscar academia'
        };
    }
}

/**
 * Calcula as estatísticas de uma academia (número de alunos e professores).
 * @param academyId O ID da academia.
 * @returns Objeto com contagem de 'students' e 'professors'.
 */
export async function getAcademyStats(academyId: string): Promise<ApiResponse<{ students: number; professors: number }>> {
    try {
        // Busca todos os usuários vinculados a esta academia e seus papéis (roles)
        const { data: academyUsers, error } = await supabase
            .from('academy_users')
            .select('user_id, users!inner(role)')
            .eq('academy_id', academyId);

        if (error) throw error;

        let students = 0;
        let professors = 0;

        // Itera sobre os usuários para contar quantos são alunos e quantos são professores
        academyUsers?.forEach((au: { user_id: string; users: { role: string }[] }) => {
            const role = au.users[0]?.role;
            if (role === 'ALUNO') students++;
            if (role === 'PROFESSOR') professors++;
        });

        return {
            success: true,
            data: { students, professors }
        };
    } catch (error) {
        console.error('Error fetching academy stats:', error);
        return {
            success: false,
            error: 'Erro ao buscar estatísticas'
        };
    }
}

export interface StorageReport {
    academyId: string;
    academyName: string;
    totalStudents: number;
    totalProfessors: number;
    totalPhotos: number;
    estimatedStorageMb: number;
    estimatedDatabaseMb: number;
}

/**
 * Retorna as estimativas de uso de banco e storage de todas as academias.
 * Agrupa N+1 queries eficientemente em JS local.
 */
export async function getSystemStorageReport(): Promise<ApiResponse<StorageReport[]>> {
    try {
        // 1. Puxa academias ativas
        const { data: academies, error: acaError } = await supabase
            .from('academies')
            .select('id, name')
            .order('name');
            
        if (acaError) throw acaError;

        // 2. Traz todos os usuários e mapeamentos separados (bypassa problemas de inner join RLS)
        const { data: allAcademyUsers } = await supabase
            .from('academy_users')
            .select('academy_id, user_id');
            
        const { data: allUsers } = await supabase
            .from('users')
            .select('id, role, photo_url');

        // Cria um mapa rápido de usuários
        const userMap = new Map();
        (allUsers || []).forEach(u => userMap.set(u.id, u));

        // 3. Processa
        const PHOTO_WEIGHT_MB = 0.15;
        const DB_USER_WEIGHT_MB = 0.01;

        const reports: StorageReport[] = (academies || []).map((aca: any) => {
            let students = 0;
            let profs = 0;
            let photos = 0;

            const usersInAca = (allAcademyUsers || []).filter((au: any) => au.academy_id === aca.id);
            
            usersInAca.forEach((au: any) => {
                const user = userMap.get(au.user_id);
                if (user?.role === 'ALUNO') students++;
                if (user?.role === 'PROFESSOR') profs++;
                if (user?.photo_url) photos++;
            });

            const totalUsers = students + profs + 1; // +1 pra admin

            return {
                academyId: aca.id,
                academyName: aca.name,
                totalStudents: students,
                totalProfessors: profs,
                totalPhotos: photos,
                estimatedStorageMb: parseFloat((photos * PHOTO_WEIGHT_MB).toFixed(2)),
                estimatedDatabaseMb: parseFloat((totalUsers * DB_USER_WEIGHT_MB).toFixed(2))
            };
        });

        // Sort by total data usage (desc)
        reports.sort((a, b) => (b.estimatedStorageMb + b.estimatedDatabaseMb) - (a.estimatedStorageMb + a.estimatedDatabaseMb));

        return { success: true, data: reports };

    } catch (error) {
        console.error('Error fetching storage report:', error);
        return { success: false, error: 'Erro ao analisar uso de dados.' };
    }
}

// ==========================================
// FUNÇÕES DE ESCRITA (CREATE, UPDATE, DELETE)
// ==========================================

/**
 * Cria uma nova academia e seu usuário administrador de forma atômica.
 * Utiliza uma função RPC (Remote Procedure Call) no banco de dados para garantir
 * que a academia e o usuário sejam criados juntos, evitando inconsistências.
 * 
 * @param data Dados da academia e do responsável.
 * @returns A academia criada ou erro.
 */
export async function createAcademy(data: CreateAcademyData): Promise<ApiResponse<Academy>> {
    try {
        // Prepara os dados para enviar à função RPC
        const academyPayload = {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            address: data.address || null,
            plan_name: data.plan_name || null,
            plan_value: data.plan_value || null
        };

        const userPayload = {
            name: data.responsible_name,
            email: data.email // Usa o mesmo email da academia
        };

        // Chama a função 'create_academy_with_user' no banco de dados
        const { data: result, error } = await supabase.rpc(
            'create_academy_with_user',
            {
                academy_data: academyPayload,
                user_data: userPayload
            }
        );

        if (error) throw error;

        // Se a função retornar sucesso: false, lançamos o erro retornado por ela
        if (result && !result.success) {
            throw new Error(result.error || 'Erro desconhecido ao criar academia');
        }

        // Se tudo der certo, buscamos a academia recém-criada para retornar os dados completos
        if (result && result.academy_id) {
            return getAcademyById(result.academy_id);
        }

        throw new Error('Erro ao obter ID da academia criada');

    } catch (error) {
        console.error('Error creating academy:', error);
        // Tratamento de erro específico para email duplicado
        if (error instanceof Error && error.message.includes('duplicate key')) {
            return {
                success: false,
                error: 'Este email já está cadastrado no sistema.'
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar academia'
        };
    }
}

/**
 * Atualiza os dados de uma academia existente.
 * @param id O ID da academia.
 * @param updates Objeto contendo os campos a serem atualizados (parcial).
 */
export async function updateAcademy(
    id: string,
    updates: Partial<Omit<Academy, 'id' | 'created_at' | 'updated_at'>>
): Promise<ApiResponse<Academy>> {
    try {
        const { data, error } = await supabase
            .from('academies')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as Academy
        };
    } catch (error) {
        console.error('Error updating academy:', error);
        return {
            success: false,
            error: 'Erro ao atualizar academia'
        };
    }
}

/**
 * Atualiza apenas o status da academia.
 * Se a academia for desativada (INACTIVE ou SUSPENDED), o usuário administrador
 * também será bloqueado para impedir acesso.
 * Se for reativada (ACTIVE), o usuário administrador será desbloqueado.
 */
export async function updateAcademyStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
): Promise<ApiResponse<Academy>> {
    try {
        // 1. Atualizar o status da academia
        const { data: academy, error: academyError } = await updateAcademy(id, { status });

        if (academyError || !academy) throw academyError;

        // 2. Determinar se o usuário deve ficar ativo ou inativo
        // Se a academia estiver ATIVA, o usuário fica ATIVO (true)
        // Se a academia estiver INATIVA ou SUSPENSA, o usuário fica INATIVO (false)
        const shouldBeActive = status === 'ACTIVE';

        // 3. Buscar o usuário administrador desta academia
        const { data: academyUsers } = await supabase
            .from('academy_users')
            .select('user_id, users!inner(role)')
            .eq('academy_id', id);

        // Identificar o admin
        const adminUser = academyUsers?.find((au: any) => au.users?.role === 'ADMIN_ACADEMIA');

        if (adminUser) {
            // 4. Atualizar o status do administrador
            await supabase
                .from('users')
                .update({ is_active: shouldBeActive })
                .eq('id', adminUser.user_id);

            console.log(`Status da academia alterado para ${status}. Usuário ${adminUser.user_id} definido como ativo=${shouldBeActive}`);
        }

        return {
            success: true,
            data: academy
        };
    } catch (error) {
        console.error('Error updating academy status:', error);
        return {
            success: false,
            error: 'Erro ao atualizar status da academia'
        };
    }
}

/**
 * Exclui uma academia completemente do sistema.
 * IMPORTANTE: Essa função realiza a exclusão em ordem específica para garantir integridade.
 * 1. Identifica todos os usuários vinculados.
 * 2. Exclui os usuários primeiro (remove da tabela pública E do sistema de login authentication).
 * 3. Exclui a academia por último.
 * 
 * @param id O ID da academia a ser excluída.
 */
export async function deleteAcademy(id: string): Promise<ApiResponse<void>> {
    try {
        // Passo 1: Identificar usuários vinculados à academia
        const { data: academyUsers } = await supabase
            .from('academy_users')
            .select('user_id')
            .eq('academy_id', id);

        // Prepara listas de IDs e Emails para exclusão
        let userEmails: string[] = [];
        let userIds: string[] = [];

        if (academyUsers && academyUsers.length > 0) {
            userIds = academyUsers.map(au => au.user_id);

            // Busca os emails desses usuários (necessário para excluir do Auth)
            const { data: users } = await supabase
                .from('users')
                .select('email')
                .in('id', userIds);

            if (users) {
                userEmails = users.map(u => u.email).filter((e): e is string => !!e);
            }

            // Passo 2a: Excluir usuários da tabela 'public.users'
            // Isso aciona exclusão em cascata para tabelas dependentes (workouts, etc.)
            const { error: usersError } = await supabase
                .from('users')
                .delete()
                .in('id', userIds);

            if (usersError) {
                console.error('Error deleting academy users:', usersError);
                throw usersError;
            }

            // Passo 2b: Excluir usuários do sistema de Autenticação (auth.users)
            // Usa uma função RPC segura para limpar o login
            for (const email of userEmails) {
                try {
                    await supabase.rpc('delete_user_by_email', { email_arg: email });
                } catch (rpcError) {
                    console.error(`Error deleting auth user ${email}:`, rpcError);
                    // Continuamos a exclusão mesmo se um usuário falhar, para não travar o processo
                }
            }
        }

        // Passo 3: Excluir a academia
        const { error } = await supabase
            .from('academies')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return {
            success: true,
            data: undefined
        };
    } catch (error) {
        console.error('Error deleting academy:', error);
        return {
            success: false,
            error: 'Erro ao excluir academia'
        };
    }
}
