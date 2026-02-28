import { supabase } from './supabase';
import type { ApiResponse, ExpiringStudentPlan } from '../types';

// ==========================================
// MENSALIDADES PERTO DE VENCER
// ==========================================

/**
 * Busca planos de alunos ativos que estão perto de vencer (0..5 dias).
 * Retorna os dados já com days_remaining calculado.
 */
export async function getExpiringStudentPlans(
    academyId: string
): Promise<ApiResponse<ExpiringStudentPlan[]>> {
    try {
        // Calcular intervalo: hoje → hoje + 5 dias
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endWindow = new Date(today);
        endWindow.setDate(endWindow.getDate() + 5);

        const formatISO = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        const todayStr = formatISO(today);
        const endStr = formatISO(endWindow);

        // Buscar student_plans ativos com plan_end_date no range
        const { data, error } = await supabase
            .from('student_plans')
            .select(`
                id,
                student_id,
                plan_id,
                plan_end_date,
                users!student_plans_student_id_fkey ( name, phone ),
                plans!student_plans_plan_id_fkey ( name, price )
            `)
            .eq('academy_id', academyId)
            .eq('is_active', true)
            .gte('plan_end_date', todayStr)
            .lte('plan_end_date', endStr)
            .order('plan_end_date', { ascending: true });

        if (error) throw error;

        // Mapear para ExpiringStudentPlan
        const results: ExpiringStudentPlan[] = (data || []).map((row: any) => {
            const endDate = new Date(row.plan_end_date + 'T00:00:00');
            const diffMs = endDate.getTime() - today.getTime();
            const daysRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

            const user = row.users || {};
            const plan = row.plans || {};

            return {
                student_plan_id: row.id,
                student_id: row.student_id,
                student_name: user.name || 'Sem nome',
                student_phone: user.phone || null,
                plan_id: row.plan_id,
                plan_name: plan.name || 'Plano',
                plan_price: plan.price || 0,
                plan_end_date: row.plan_end_date,
                days_remaining: daysRemaining
            };
        });

        return { success: true, data: results };
    } catch (error) {
        console.error('Error fetching expiring student plans:', error);
        return {
            success: false,
            error: 'Erro ao buscar mensalidades perto de vencer'
        };
    }
}

// ==========================================
// LINK WHATSAPP
// ==========================================

/**
 * Gera a URL do WhatsApp com mensagem pré-formatada de aviso de vencimento.
 */
export function buildWhatsAppLink(
    phone: string,
    studentName: string,
    planName: string,
    daysRemaining: number,
    planEndDate: string
): string {
    // Limpar telefone: remover tudo que não é dígito
    const cleanPhone = phone.replace(/\D/g, '');

    // Se não começar com código do país, assumir Brasil (55)
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // Formatar data para DD/MM/YYYY
    const [year, month, day] = planEndDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    let message = '';
    if (daysRemaining === 0) {
        message = `Olá ${studentName}! 👋\n\nSua mensalidade do plano *${planName}* vence *hoje* (${formattedDate}).\n\nPara continuar treinando sem interrupções, realize o pagamento o quanto antes! 💪\n\nQualquer dúvida, estamos à disposição.`;
    } else if (daysRemaining === 1) {
        message = `Olá ${studentName}! 👋\n\nSua mensalidade do plano *${planName}* vence *amanhã* (${formattedDate}).\n\nRenove sua matrícula para continuar aproveitando todos os benefícios! 💪\n\nQualquer dúvida, estamos à disposição.`;
    } else {
        message = `Olá ${studentName}! 👋\n\nSua mensalidade do plano *${planName}* vence em *${daysRemaining} dias* (${formattedDate}).\n\nLembre-se de renovar para não perder acesso! 💪\n\nQualquer dúvida, estamos à disposição.`;
    }

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
