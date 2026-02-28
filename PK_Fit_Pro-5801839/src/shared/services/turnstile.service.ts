import { supabase } from './supabase';
import type { ApiResponse } from '../types';

// ==========================================
// TIPOS
// ==========================================

export type TurnstileBrand = 'CONTROL_ID' | 'TOP_DATA' | 'HENRY';
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type AccessDirection = 'IN' | 'OUT';
export type DenialReason = 'INADIMPLENTE' | 'BLOQUEADO' | 'FORA_DO_HORARIO' | 'PLANO_VENCIDO' | 'NAO_ENCONTRADO';
export type IdentificationMethod = 'BIOMETRIC' | 'CARD' | 'QR_CODE' | 'FACIAL' | 'MANUAL';
export type CommandType = 'GRANT_ACCESS' | 'DENY_ACCESS' | 'SYNC_USERS' | 'REBOOT';
export type CommandStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED';

export interface TurnstileConfig {
    id: string;
    academy_id: string;
    name: string;
    brand: TurnstileBrand;
    model: string | null;
    ip_address: string | null;
    port: number;
    auth_user: string | null;
    auth_password: string | null;
    is_active: boolean;
    connection_status: ConnectionStatus;
    last_heartbeat: string | null;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface AccessLog {
    id: string;
    academy_id: string;
    user_id: string | null;
    turnstile_config_id: string | null;
    direction: AccessDirection;
    access_granted: boolean;
    denial_reason: DenialReason | null;
    identification_method: IdentificationMethod | null;
    raw_credential: string | null;
    user_name: string | null;
    created_at: string;
}

export interface AccessValidationResult {
    granted: boolean;
    reason: string;
    message: string;
    user_name?: string;
    plan_name?: string;
    plan_end_date?: string;
    allowed_start?: string;
    allowed_end?: string;
}

export interface CreateTurnstileData {
    academy_id: string;
    name: string;
    brand: TurnstileBrand;
    model?: string;
    ip_address?: string;
    port?: number;
    auth_user?: string;
    auth_password?: string;
}

// ==========================================
// MODELOS DE CATRACA POR MARCA
// ==========================================

export const TURNSTILE_BRANDS: { value: TurnstileBrand; label: string; models: string[] }[] = [
    {
        value: 'CONTROL_ID',
        label: 'Control ID',
        models: [
            // Reconhecimento Facial
            'iDFace',
            'iDFace Max',
            'iDFace Mini',
            // Catracas / Bloqueios
            'iDBlock',
            'iDBlock Next',
            'iDBlock V2',
            'iDBlock PNE',
            // Controladores de Acesso
            'iDFlex',
            'iDFlex Pro',
            'iDFlex Lite',
            // Leitores Biométricos
            'iDFit',
            'iDBio',
            // Acesso Veicular / Pedestre
            'iDAccess',
            'iDAccess Pro',
            'iDAccess Nano',
            // Outros
            'iDBox',
            'iDFlap',
            'Outro modelo Control ID'
        ]
    },
    {
        value: 'TOP_DATA',
        label: 'Top Data',
        models: [
            'Revolution 4',
            'Revolution 5',
            'Inner Portaria',
            'Inner Acesso',
            'Inner Rep',
            'Top Flex',
            'Outro modelo Top Data'
        ]
    },
    {
        value: 'HENRY',
        label: 'Henry',
        models: [
            'Argos',
            'PrimmeAcesso SF',
            'Lumen Facial',
            'Catraca SF',
            'Orion 6',
            'Super Easy',
            'Outro modelo Henry'
        ]
    }
];

// ==========================================
// CONFIGURAÇÃO DA CATRACA (CRUD)
// ==========================================

// Buscar catracas da academia
export async function getTurnstileConfigs(academyId: string): Promise<ApiResponse<TurnstileConfig[]>> {
    try {
        const { data, error } = await supabase
            .from('turnstile_configs')
            .select('*')
            .eq('academy_id', academyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, data: (data || []) as TurnstileConfig[] };
    } catch (error) {
        console.error('Error fetching turnstile configs:', error);
        return { success: false, error: 'Erro ao buscar configurações de catraca' };
    }
}

// Criar configuração de catraca
export async function createTurnstileConfig(data: CreateTurnstileData): Promise<ApiResponse<TurnstileConfig>> {
    try {
        if (!data.academy_id) return { success: false, error: 'Academy ID é obrigatório' };
        if (!data.brand) return { success: false, error: 'Marca é obrigatória' };
        if (!data.name || data.name.trim() === '') return { success: false, error: 'Nome é obrigatório' };

        const { data: config, error } = await supabase
            .from('turnstile_configs')
            .insert({
                academy_id: data.academy_id,
                name: data.name.trim(),
                brand: data.brand,
                model: data.model || null,
                ip_address: data.ip_address || null,
                port: data.port || 80,
                auth_user: data.auth_user || null,
                auth_password: data.auth_password || null,
                is_active: true,
                connection_status: 'DISCONNECTED'
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, data: config as TurnstileConfig };
    } catch (error) {
        console.error('Error creating turnstile config:', error);
        return { success: false, error: 'Erro ao criar configuração de catraca' };
    }
}

// Atualizar configuração
export async function updateTurnstileConfig(
    id: string,
    updates: Partial<Pick<TurnstileConfig, 'name' | 'brand' | 'model' | 'ip_address' | 'port' | 'auth_user' | 'auth_password' | 'is_active' | 'settings'>>
): Promise<ApiResponse<TurnstileConfig>> {
    try {
        const { data, error } = await supabase
            .from('turnstile_configs')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data: data as TurnstileConfig };
    } catch (error) {
        console.error('Error updating turnstile config:', error);
        return { success: false, error: 'Erro ao atualizar configuração' };
    }
}

// Excluir configuração
export async function deleteTurnstileConfig(id: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('turnstile_configs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return { success: true, data: undefined };
    } catch (error) {
        console.error('Error deleting turnstile config:', error);
        return { success: false, error: 'Erro ao excluir configuração' };
    }
}

// ==========================================
// VALIDAÇÃO DE ACESSO (RÁPIDA)
// ==========================================

// Validar acesso do aluno via RPC (mais rápido possível)
export async function validateStudentAccess(
    academyId: string,
    userId: string
): Promise<ApiResponse<AccessValidationResult>> {
    try {
        const { data, error } = await supabase.rpc('validate_student_access', {
            p_academy_id: academyId,
            p_user_id: userId
        });

        if (error) throw error;

        return { success: true, data: data as AccessValidationResult };
    } catch (error) {
        console.error('Error validating access:', error);
        return { success: false, error: 'Erro ao validar acesso' };
    }
}

// ==========================================
// LOGS DE ACESSO
// ==========================================

// Registrar log de acesso
export async function registerAccessLog(log: {
    academy_id: string;
    user_id?: string;
    turnstile_config_id?: string;
    direction: AccessDirection;
    access_granted: boolean;
    denial_reason?: DenialReason;
    identification_method?: IdentificationMethod;
    raw_credential?: string;
    user_name?: string;
}): Promise<ApiResponse<AccessLog>> {
    try {
        const { data, error } = await supabase
            .from('access_logs')
            .insert(log)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data: data as AccessLog };
    } catch (error) {
        console.error('Error registering access log:', error);
        return { success: false, error: 'Erro ao registrar log de acesso' };
    }
}

// Buscar logs de acesso com filtros
export async function getAccessLogs(
    academyId: string,
    options?: {
        limit?: number;
        offset?: number;
        dateFrom?: string;
        dateTo?: string;
        onlyGranted?: boolean;
        onlyDenied?: boolean;
        userId?: string;
    }
): Promise<ApiResponse<{ logs: AccessLog[]; total: number }>> {
    try {
        let query = supabase
            .from('access_logs')
            .select('*', { count: 'exact' })
            .eq('academy_id', academyId)
            .order('created_at', { ascending: false });

        if (options?.dateFrom) {
            query = query.gte('created_at', options.dateFrom);
        }
        if (options?.dateTo) {
            query = query.lte('created_at', options.dateTo + 'T23:59:59');
        }
        if (options?.onlyGranted) {
            query = query.eq('access_granted', true);
        }
        if (options?.onlyDenied) {
            query = query.eq('access_granted', false);
        }
        if (options?.userId) {
            query = query.eq('user_id', options.userId);
        }

        const limit = options?.limit || 50;
        const offset = options?.offset || 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            success: true,
            data: {
                logs: (data || []) as AccessLog[],
                total: count || 0
            }
        };
    } catch (error) {
        console.error('Error fetching access logs:', error);
        return { success: false, error: 'Erro ao buscar logs de acesso' };
    }
}

// ==========================================
// OCUPAÇÃO
// ==========================================

// Ocupação atual da academia
export async function getAcademyOccupancy(academyId: string): Promise<ApiResponse<number>> {
    try {
        const { data, error } = await supabase.rpc('get_academy_occupancy', {
            p_academy_id: academyId
        });

        if (error) throw error;

        return { success: true, data: (data as number) || 0 };
    } catch (error) {
        console.error('Error fetching occupancy:', error);
        return { success: false, error: 'Erro ao buscar ocupação' };
    }
}

// ==========================================
// COMANDOS PARA O AGENT LOCAL
// ==========================================

// Enviar comando para a catraca (via fila no banco)
export async function sendTurnstileCommand(command: {
    academy_id: string;
    turnstile_config_id?: string;
    command_type: CommandType;
    payload?: Record<string, unknown>;
}): Promise<ApiResponse<{ id: string }>> {
    try {
        const { data, error } = await supabase
            .from('access_commands')
            .insert({
                academy_id: command.academy_id,
                turnstile_config_id: command.turnstile_config_id || null,
                command_type: command.command_type,
                payload: command.payload || {},
                status: 'PENDING'
            })
            .select('id')
            .single();

        if (error) throw error;

        return { success: true, data: { id: data.id } };
    } catch (error) {
        console.error('Error sending command:', error);
        return { success: false, error: 'Erro ao enviar comando' };
    }
}

// Estatísticas de acesso do dia
export async function getTodayAccessStats(academyId: string): Promise<ApiResponse<{
    total_entries: number;
    total_denied: number;
    by_reason: Record<string, number>;
}>> {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Total de entradas liberadas
        const { count: totalEntries } = await supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true })
            .eq('academy_id', academyId)
            .eq('access_granted', true)
            .eq('direction', 'IN')
            .gte('created_at', today);

        // Total de acessos negados
        const { count: totalDenied } = await supabase
            .from('access_logs')
            .select('*', { count: 'exact', head: true })
            .eq('academy_id', academyId)
            .eq('access_granted', false)
            .gte('created_at', today);

        // Acessos negados por motivo
        const { data: deniedLogs } = await supabase
            .from('access_logs')
            .select('denial_reason')
            .eq('academy_id', academyId)
            .eq('access_granted', false)
            .gte('created_at', today);

        const byReason: Record<string, number> = {};
        (deniedLogs || []).forEach(log => {
            const reason = log.denial_reason || 'OUTROS';
            byReason[reason] = (byReason[reason] || 0) + 1;
        });

        return {
            success: true,
            data: {
                total_entries: totalEntries || 0,
                total_denied: totalDenied || 0,
                by_reason: byReason
            }
        };
    } catch (error) {
        console.error('Error fetching today stats:', error);
        return { success: false, error: 'Erro ao buscar estatísticas do dia' };
    }
}

// ==========================================
// CÓDIGO DE PAREAMENTO
// ==========================================

// Gerar código de pareamento para o Agent Local
export async function generatePairingCode(
    academyId: string,
    turnstileConfigId: string
): Promise<ApiResponse<string>> {
    try {
        const { data, error } = await supabase.rpc('generate_pairing_code', {
            p_academy_id: academyId,
            p_turnstile_config_id: turnstileConfigId
        });

        if (error) throw error;

        return { success: true, data: data as string };
    } catch (error) {
        console.error('Error generating pairing code:', error);
        return { success: false, error: 'Erro ao gerar código de pareamento' };
    }
}
