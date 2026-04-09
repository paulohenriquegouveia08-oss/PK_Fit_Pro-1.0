import type { AgentConfig } from '../config';
import type { TurnstileAdapter } from '../adapters/adapter.interface';
import { getSupabase } from './client';
import { logger } from '../core/logger';

/**
 * Realiza a sincronização completa de membros da academia para a catraca.
 * Busca todos os usuários vinculados à academia no Supabase e os envia ao hardware.
 */
export async function syncAcademyMembers(config: AgentConfig, adapter: TurnstileAdapter): Promise<void> {
    const supabase = getSupabase();
    
    logger.info(`🔄 Iniciando sincronização de membros para a academia: ${config.academyName}`);

    try {
        // 1. Buscar todos os IDs de usuários vinculados a esta academia
        const { data: academyUsers, error: auError } = await supabase
            .from('academy_users')
            .select('user_id')
            .eq('academy_id', config.academyId);

        if (auError) throw auError;

        if (!academyUsers || academyUsers.length === 0) {
            logger.info('ℹ️ Nenhum membro encontrado para sincronização.');
            return;
        }

        const userIds = academyUsers.map(au => au.user_id);

        // 2. Buscar detalhes dos usuários (nome e foto) que são Alunos ou Professores
        const { data: users, error: uError } = await supabase
            .from('users')
            .select('id, name, photo_url, role, is_active')
            .in('id', userIds)
            .in('role', ['ALUNO', 'PROFESSOR']);

        if (uError) throw uError;

        logger.info(`👥 Encontrados ${users?.length || 0} membros para processar.`);

        // 3. Sincronizar cada usuário com o hardware
        for (const user of users || []) {
            if (!adapter.syncUserFace) {
                logger.warn(`⚠️ O adaptador ${adapter.brandName} não suporta sincronização de face.`);
                break;
            }

            try {
                if (user.is_active) {
                    await adapter.syncUserFace(user.id, user.name, user.photo_url || '');
                } else {
                    // Se estiver inativo, removemos da catraca por segurança
                    if (adapter.removeUser) {
                        await adapter.removeUser(user.id);
                    }
                }
            } catch (err) {
                // Logamos o erro mas continuamos para o próximo usuário
                logger.error(`❌ Falha ao sincronizar usuário ${user.name}: ${err}`);
            }
        }

        logger.info('✅ Sincronização de membros finalizada.');
    } catch (error) {
        logger.error(`❌ Erro crítico na sincronização: ${error}`);
    }
}
