import { supabase } from './supabase';
import type {
    ApiResponse,
    FinancialSummary,
    ChartDataPoint,
    PlanDistribution,
    Payment,
    Expense,
    StudentPlanDetail,
    PaymentDetail,
    ExpenseDetail,
    PlanWithRevenue,
    PaidUnpaidCounts,
    PaymentMethodType
} from '../types';

// ==========================================
// TIPOS AUXILIARES
// ==========================================

export type GroupBy = 'daily' | 'monthly' | 'yearly';

export interface CreatePaymentData {
    academy_id: string;
    student_id?: string;
    plan_id?: string;
    amount: number;
    status: 'pago' | 'pendente' | 'cancelado';
    payment_date: string;
    description?: string;
}

export interface CreateExpenseData {
    academy_id: string;
    description: string;
    category?: string;
    amount: number;
    expense_date: string;
}

// ==========================================
// RESUMO FINANCEIRO
// ==========================================

export async function getFinancialSummary(
    academyId: string,
    startDate: string,
    endDate: string
): Promise<ApiResponse<FinancialSummary>> {
    try {
        // Total faturado (pagamentos com status 'pago')
        const { data: payments, error: payError } = await supabase
            .from('payments')
            .select('amount')
            .eq('academy_id', academyId)
            .eq('status', 'pago')
            .gte('payment_date', startDate)
            .lte('payment_date', endDate);

        if (payError) throw payError;

        const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

        // Total de despesas
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('amount')
            .eq('academy_id', academyId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate);

        if (expError) throw expError;

        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

        return {
            success: true,
            data: {
                totalRevenue,
                totalExpenses,
                netProfit: totalRevenue - totalExpenses
            }
        };
    } catch (error) {
        console.error('Error fetching financial summary:', error);
        return { success: false, error: 'Erro ao buscar resumo financeiro' };
    }
}

// ==========================================
// DADOS PARA GRÁFICO
// ==========================================

function groupByLabel(dateStr: string, groupBy: GroupBy): string {
    const d = new Date(dateStr + 'T00:00:00');
    switch (groupBy) {
        case 'daily': {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
        }
        case 'monthly': {
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${months[d.getMonth()]}/${d.getFullYear()}`;
        }
        case 'yearly':
            return String(d.getFullYear());
    }
}

export async function getChartData(
    academyId: string,
    startDate: string,
    endDate: string,
    groupBy: GroupBy
): Promise<ApiResponse<ChartDataPoint[]>> {
    try {
        // Buscar pagamentos pagos
        const { data: payments, error: payError } = await supabase
            .from('payments')
            .select('amount, payment_date')
            .eq('academy_id', academyId)
            .eq('status', 'pago')
            .gte('payment_date', startDate)
            .lte('payment_date', endDate)
            .order('payment_date', { ascending: true });

        if (payError) throw payError;

        // Buscar despesas
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('amount, expense_date')
            .eq('academy_id', academyId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .order('expense_date', { ascending: true });

        if (expError) throw expError;

        // Agrupar por período
        const revenueMap = new Map<string, number>();
        const expenseMap = new Map<string, number>();

        for (const p of payments || []) {
            const label = groupByLabel(p.payment_date, groupBy);
            revenueMap.set(label, (revenueMap.get(label) || 0) + Number(p.amount));
        }

        for (const e of expenses || []) {
            const label = groupByLabel(e.expense_date, groupBy);
            expenseMap.set(label, (expenseMap.get(label) || 0) + Number(e.amount));
        }

        // Combinar em array
        const allLabels = new Set([...revenueMap.keys(), ...expenseMap.keys()]);
        const chartData: ChartDataPoint[] = Array.from(allLabels)
            .sort()
            .map(label => ({
                label,
                revenue: revenueMap.get(label) || 0,
                expenses: expenseMap.get(label) || 0
            }));

        return { success: true, data: chartData };
    } catch (error) {
        console.error('Error fetching chart data:', error);
        return { success: false, error: 'Erro ao buscar dados do gráfico' };
    }
}

// ==========================================
// DISTRIBUIÇÃO POR PLANO
// ==========================================

export async function getPlanDistribution(
    academyId: string
): Promise<ApiResponse<PlanDistribution[]>> {
    try {
        // Buscar planos ativos
        const { data: plans, error: planError } = await supabase
            .from('plans')
            .select('id, name, duration_in_months, price')
            .eq('academy_id', academyId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (planError) throw planError;

        // Para cada plano, contar alunos vinculados ativos
        const distribution: PlanDistribution[] = [];
        for (const plan of plans || []) {
            const { count } = await supabase
                .from('student_plans')
                .select('*', { count: 'exact', head: true })
                .eq('plan_id', plan.id)
                .eq('academy_id', academyId)
                .eq('is_active', true);

            distribution.push({
                id: plan.id,
                name: plan.name,
                duration_in_months: plan.duration_in_months,
                price: Number(plan.price),
                student_count: count || 0
            });
        }

        return { success: true, data: distribution };
    } catch (error) {
        console.error('Error fetching plan distribution:', error);
        return { success: false, error: 'Erro ao buscar distribuição de planos' };
    }
}

// ==========================================
// CONTADORES
// ==========================================

export async function getActivePlanCount(academyId: string): Promise<ApiResponse<number>> {
    try {
        const { count, error } = await supabase
            .from('plans')
            .select('*', { count: 'exact', head: true })
            .eq('academy_id', academyId)
            .eq('is_active', true);

        if (error) throw error;
        return { success: true, data: count || 0 };
    } catch (error) {
        console.error('Error counting active plans:', error);
        return { success: false, error: 'Erro ao contar planos' };
    }
}

export async function getActiveStudentCount(academyId: string): Promise<ApiResponse<number>> {
    try {
        const { count, error } = await supabase
            .from('student_plans')
            .select('*', { count: 'exact', head: true })
            .eq('academy_id', academyId)
            .eq('is_active', true);

        if (error) throw error;
        return { success: true, data: count || 0 };
    } catch (error) {
        console.error('Error counting active students:', error);
        return { success: false, error: 'Erro ao contar alunos ativos' };
    }
}

// ==========================================
// CRUD PAGAMENTOS
// ==========================================

export async function createPayment(data: CreatePaymentData): Promise<ApiResponse<Payment>> {
    try {
        const { data: payment, error } = await supabase
            .from('payments')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: payment as Payment };
    } catch (error) {
        console.error('Error creating payment:', error);
        return { success: false, error: 'Erro ao criar pagamento' };
    }
}

export async function getPayments(
    academyId: string,
    startDate: string,
    endDate: string
): Promise<ApiResponse<Payment[]>> {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('academy_id', academyId)
            .gte('payment_date', startDate)
            .lte('payment_date', endDate)
            .order('payment_date', { ascending: false });

        if (error) throw error;
        return { success: true, data: (data || []) as Payment[] };
    } catch (error) {
        console.error('Error fetching payments:', error);
        return { success: false, error: 'Erro ao buscar pagamentos' };
    }
}

// ==========================================
// CRUD DESPESAS
// ==========================================

export async function createExpense(data: CreateExpenseData): Promise<ApiResponse<Expense>> {
    try {
        const { data: expense, error } = await supabase
            .from('expenses')
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: expense as Expense };
    } catch (error) {
        console.error('Error creating expense:', error);
        return { success: false, error: 'Erro ao criar despesa' };
    }
}

export async function getExpenses(
    academyId: string,
    startDate: string,
    endDate: string
): Promise<ApiResponse<Expense[]>> {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('academy_id', academyId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .order('expense_date', { ascending: false });

        if (error) throw error;
        return { success: true, data: (data || []) as Expense[] };
    } catch (error) {
        console.error('Error fetching expenses:', error);
        return { success: false, error: 'Erro ao buscar despesas' };
    }
}

// ==========================================
// MARCAR PLANO COMO PAGO
// ==========================================

export async function markStudentPlanAsPaid(
    studentId: string,
    planId: string,
    academyId: string,
    amount: number,
    paymentMethod?: PaymentMethodType
): Promise<ApiResponse<Payment>> {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Verificar se já existe pagamento para esse aluno/plano neste mês
        const monthStart = today.substring(0, 7) + '-01';
        const { data: existing } = await supabase
            .from('payments')
            .select('id')
            .eq('academy_id', academyId)
            .eq('student_id', studentId)
            .eq('plan_id', planId)
            .eq('status', 'pago')
            .gte('payment_date', monthStart)
            .lte('payment_date', today);

        if (existing && existing.length > 0) {
            return { success: false, error: 'Pagamento já registrado para este período' };
        }

        const { data: payment, error } = await supabase
            .from('payments')
            .insert({
                academy_id: academyId,
                student_id: studentId,
                plan_id: planId,
                amount,
                status: 'pago',
                payment_method: paymentMethod, // Added payment_method
                payment_date: today,
                description: 'Pagamento de plano'
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: payment as Payment };
    } catch (error) {
        console.error('Error marking as paid:', error);
        return { success: false, error: 'Erro ao registrar pagamento' };
    }
}

// ==========================================
// REMOVER PAGAMENTO (ESTORNAR)
// ==========================================

export async function markStudentPlanAsUnpaid(
    studentId: string,
    planId: string,
    academyId: string
): Promise<ApiResponse<null>> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        // Só pode estornar se o pagamento for do mês corrente
        const { data: payments, error: findError } = await supabase
            .from('payments')
            .select('id')
            .eq('academy_id', academyId)
            .eq('student_id', studentId)
            .eq('plan_id', planId)
            .eq('status', 'pago')
            .gte('payment_date', monthStart)
            .lte('payment_date', today);

        if (findError) throw findError;

        if (!payments || payments.length === 0) {
            return { success: false, error: 'Nenhum pagamento encontrado neste período para estornar' };
        }

        // Atualizar para cancelado (não deletar — preserva histórico)
        const { error } = await supabase
            .from('payments')
            .update({ status: 'cancelado' })
            .eq('id', payments[0].id);

        if (error) throw error;
        return { success: true, data: null };
    } catch (error) {
        console.error('Error marking as unpaid:', error);
        return { success: false, error: 'Erro ao estornar pagamento' };
    }
}

// ==========================================
// VERIFICAR STATUS DE PAGAMENTO DO ALUNO
// ==========================================

export async function getStudentPaymentStatus(
    studentId: string,
    planId: string,
    academyId: string
): Promise<'pago' | 'nao_pago'> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const { data } = await supabase
            .from('payments')
            .select('id')
            .eq('academy_id', academyId)
            .eq('student_id', studentId)
            .eq('plan_id', planId)
            .eq('status', 'pago')
            .gte('payment_date', monthStart)
            .lte('payment_date', today);

        return (data && data.length > 0) ? 'pago' : 'nao_pago';
    } catch {
        return 'nao_pago';
    }
}

// ==========================================
// DRILL-DOWN: ALUNOS POR PLANO
// ==========================================

export async function getPlanStudentsDetail(
    planId: string,
    academyId: string
): Promise<ApiResponse<StudentPlanDetail[]>> {
    try {
        // Buscar student_plans ativos para este plano
        const { data: studentPlans, error } = await supabase
            .from('student_plans')
            .select('student_id, plan_start_date, plan_end_date')
            .eq('plan_id', planId)
            .eq('academy_id', academyId)
            .eq('is_active', true);

        if (error) throw error;

        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const details: StudentPlanDetail[] = [];
        for (const sp of studentPlans || []) {
            // Buscar nome do aluno
            const { data: user } = await supabase
                .from('users')
                .select('name')
                .eq('id', sp.student_id)
                .single();

            // Buscar plano preço
            const { data: plan } = await supabase
                .from('plans')
                .select('price')
                .eq('id', planId)
                .single();

            // Verificar pagamento
            const { data: payments } = await supabase
                .from('payments')
                .select('id')
                .eq('student_id', sp.student_id)
                .eq('plan_id', planId)
                .eq('academy_id', academyId)
                .eq('status', 'pago')
                .gte('payment_date', monthStart)
                .lte('payment_date', today);

            details.push({
                student_id: sp.student_id,
                student_name: user?.name || 'Desconhecido',
                plan_start_date: sp.plan_start_date,
                plan_end_date: sp.plan_end_date,
                plan_price: Number(plan?.price || 0),
                payment_status: (payments && payments.length > 0) ? 'pago' : 'nao_pago'
            });
        }

        return { success: true, data: details };
    } catch (error) {
        console.error('Error fetching plan students:', error);
        return { success: false, error: 'Erro ao buscar alunos do plano' };
    }
}

// ==========================================
// DRILL-DOWN: DETALHES DE PAGAMENTOS
// ==========================================

export async function getPaymentDetailsForPeriod(
    academyId: string,
    startDate: string,
    endDate: string
): Promise<ApiResponse<PaymentDetail[]>> {
    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('id, payment_date, amount, status, student_id, plan_id, description')
            .eq('academy_id', academyId)
            .eq('status', 'pago')
            .gte('payment_date', startDate)
            .lte('payment_date', endDate)
            .order('payment_date', { ascending: false });

        if (error) throw error;

        const details: PaymentDetail[] = [];
        for (const p of payments || []) {
            let studentName = '';
            let planName = '';

            if (p.student_id) {
                const { data: user } = await supabase
                    .from('users')
                    .select('name')
                    .eq('id', p.student_id)
                    .single();
                studentName = user?.name || '';
            }
            if (p.plan_id) {
                const { data: plan } = await supabase
                    .from('plans')
                    .select('name')
                    .eq('id', p.plan_id)
                    .single();
                planName = plan?.name || '';
            }

            details.push({
                id: p.id,
                payment_date: p.payment_date,
                amount: Number(p.amount),
                status: p.status,
                student_name: studentName,
                plan_name: planName,
                description: p.description
            });
        }

        return { success: true, data: details };
    } catch (error) {
        console.error('Error fetching payment details:', error);
        return { success: false, error: 'Erro ao buscar detalhes de pagamentos' };
    }
}

// ==========================================
// DRILL-DOWN: DETALHES DE DESPESAS
// ==========================================

export async function getExpenseDetailsForPeriod(
    academyId: string,
    startDate: string,
    endDate: string
): Promise<ApiResponse<ExpenseDetail[]>> {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('id, expense_date, description, category, amount')
            .eq('academy_id', academyId)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .order('expense_date', { ascending: false });

        if (error) throw error;
        return { success: true, data: (data || []) as ExpenseDetail[] };
    } catch (error) {
        console.error('Error fetching expense details:', error);
        return { success: false, error: 'Erro ao buscar detalhes de despesas' };
    }
}

// ==========================================
// CONTADORES PAGO/NÃO PAGO
// ==========================================

export async function getPaidUnpaidCounts(
    academyId: string
): Promise<ApiResponse<PaidUnpaidCounts>> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        // Total de student_plans ativos
        const { data: allStudentPlans } = await supabase
            .from('student_plans')
            .select('student_id, plan_id')
            .eq('academy_id', academyId)
            .eq('is_active', true);

        let paid = 0;
        let unpaid = 0;

        for (const sp of allStudentPlans || []) {
            const { data: payments } = await supabase
                .from('payments')
                .select('id')
                .eq('academy_id', academyId)
                .eq('student_id', sp.student_id)
                .eq('plan_id', sp.plan_id)
                .eq('status', 'pago')
                .gte('payment_date', monthStart)
                .lte('payment_date', today);

            if (payments && payments.length > 0) {
                paid++;
            } else {
                unpaid++;
            }
        }

        return { success: true, data: { paid, unpaid } };
    } catch (error) {
        console.error('Error counting paid/unpaid:', error);
        return { success: false, error: 'Erro ao contar pagos/não pagos' };
    }
}

// ==========================================
// PLANOS ATIVOS COM FATURAMENTO
// ==========================================

export async function getActivePlansWithRevenue(
    academyId: string
): Promise<ApiResponse<PlanWithRevenue[]>> {
    try {
        const { data: plans, error } = await supabase
            .from('plans')
            .select('id, name, duration_in_months, price')
            .eq('academy_id', academyId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        const result: PlanWithRevenue[] = [];
        for (const plan of plans || []) {
            // Contar alunos
            const { count } = await supabase
                .from('student_plans')
                .select('*', { count: 'exact', head: true })
                .eq('plan_id', plan.id)
                .eq('academy_id', academyId)
                .eq('is_active', true);

            // Somar faturamento
            const { data: payments } = await supabase
                .from('payments')
                .select('amount')
                .eq('plan_id', plan.id)
                .eq('academy_id', academyId)
                .eq('status', 'pago');

            const totalRevenue = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

            result.push({
                id: plan.id,
                name: plan.name,
                duration_in_months: plan.duration_in_months,
                price: Number(plan.price),
                student_count: count || 0,
                total_revenue: totalRevenue
            });
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching plans with revenue:', error);
        return { success: false, error: 'Erro ao buscar planos com faturamento' };
    }
}

// ==========================================
// LISTAR ALUNOS PAGOS / NÃO PAGOS
// ==========================================

import type { PaidUnpaidStudent } from '../types';

export async function getPaidStudents(
    academyId: string
): Promise<ApiResponse<PaidUnpaidStudent[]>> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const { data: studentPlans } = await supabase
            .from('student_plans')
            .select('student_id, plan_id')
            .eq('academy_id', academyId)
            .eq('is_active', true);

        const result: PaidUnpaidStudent[] = [];
        const seen = new Set<string>();

        for (const sp of studentPlans || []) {
            if (seen.has(sp.student_id)) continue;

            const { data: payments } = await supabase
                .from('payments')
                .select('payment_date')
                .eq('academy_id', academyId)
                .eq('student_id', sp.student_id)
                .eq('plan_id', sp.plan_id)
                .eq('status', 'pago')
                .gte('payment_date', monthStart)
                .lte('payment_date', today)
                .limit(1);

            if (payments && payments.length > 0) {
                const { data: user } = await supabase
                    .from('users')
                    .select('name, email')
                    .eq('id', sp.student_id)
                    .single();

                const { data: plan } = await supabase
                    .from('plans')
                    .select('name, price')
                    .eq('id', sp.plan_id)
                    .single();

                seen.add(sp.student_id);
                result.push({
                    id: sp.student_id,
                    name: user?.name || '',
                    email: user?.email || '',
                    plan_name: plan?.name,
                    plan_price: plan ? Number(plan.price) : undefined,
                    payment_date: payments[0].payment_date
                });
            }
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching paid students:', error);
        return { success: false, error: 'Erro ao buscar alunos pagos' };
    }
}

export async function getUnpaidStudents(
    academyId: string
): Promise<ApiResponse<PaidUnpaidStudent[]>> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        const { data: studentPlans } = await supabase
            .from('student_plans')
            .select('student_id, plan_id')
            .eq('academy_id', academyId)
            .eq('is_active', true);

        const result: PaidUnpaidStudent[] = [];
        const seen = new Set<string>();

        for (const sp of studentPlans || []) {
            if (seen.has(sp.student_id)) continue;

            const { data: payments } = await supabase
                .from('payments')
                .select('id')
                .eq('academy_id', academyId)
                .eq('student_id', sp.student_id)
                .eq('plan_id', sp.plan_id)
                .eq('status', 'pago')
                .gte('payment_date', monthStart)
                .lte('payment_date', today)
                .limit(1);

            if (!payments || payments.length === 0) {
                const { data: user } = await supabase
                    .from('users')
                    .select('name, email')
                    .eq('id', sp.student_id)
                    .single();

                const { data: plan } = await supabase
                    .from('plans')
                    .select('name, price')
                    .eq('id', sp.plan_id)
                    .single();

                seen.add(sp.student_id);
                result.push({
                    id: sp.student_id,
                    name: user?.name || '',
                    email: user?.email || '',
                    plan_name: plan?.name,
                    plan_price: plan ? Number(plan.price) : undefined
                });
            }
        }

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching unpaid students:', error);
        return { success: false, error: 'Erro ao buscar alunos não pagos' };
    }
}
