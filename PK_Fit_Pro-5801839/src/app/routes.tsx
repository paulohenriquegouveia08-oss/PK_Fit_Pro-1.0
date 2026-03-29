import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './guards';

// Auth
import { LoginPage } from '../features/auth';

// Admin Global
import {
    Dashboard as AdminGlobalDashboard,
    Academias,
    Financeiro
} from '../features/adminGlobal';

// Admin Academia
import {
    Dashboard as AdminAcademiaDashboard,
    Professores,
    Alunos as AdminAcademiaAlunos,
    Planos,
    Financeiro as AdminAcademiaFinanceiro,
    Feedbacks as AdminAcademiaFeedbacks,
    Solicitacoes as AdminAcademiaSolicitacoes,
    MensalidadesVencendo,
    ControleAcesso
} from '../features/adminAcademia';

// Professor
import {
    Alunos as ProfessorAlunos,
    CriarTreino,
    Solicitacoes,
    ProfessorPerfil,
    ProfessorFeedbacks
} from '../features/professor';

// Aluno
import {
    MeuTreino,
    Perfil,
    Feedback as AlunoFeedback,
    DiarioTreino,
    IniciarTreino,
    Evolucao,
    CriarMeuTreino
} from '../features/aluno';

export function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
                <PublicRoute>
                    <LoginPage />
                </PublicRoute>
            } />

            {/* Admin Global Routes */}
            <Route path="/admin-global" element={
                <ProtectedRoute allowedRoles={['ADMIN_GLOBAL']}>
                    <AdminGlobalDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin-global/academias" element={
                <ProtectedRoute allowedRoles={['ADMIN_GLOBAL']}>
                    <Academias />
                </ProtectedRoute>
            } />
            <Route path="/admin-global/financeiro" element={
                <ProtectedRoute allowedRoles={['ADMIN_GLOBAL']}>
                    <Financeiro />
                </ProtectedRoute>
            } />

            {/* Admin Academia Routes */}
            <Route path="/admin-academia" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <AdminAcademiaDashboard />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/professores" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <Professores />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/alunos" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <AdminAcademiaAlunos />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/planos" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <Planos />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/financeiro" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <AdminAcademiaFinanceiro />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/feedbacks" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <AdminAcademiaFeedbacks />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/solicitacoes" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <AdminAcademiaSolicitacoes />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/mensalidades-vencendo" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <MensalidadesVencendo />
                </ProtectedRoute>
            } />
            <Route path="/admin-academia/controle-acesso" element={
                <ProtectedRoute allowedRoles={['ADMIN_ACADEMIA']}>
                    <ControleAcesso />
                </ProtectedRoute>
            } />

            {/* Professor Routes */}
            <Route path="/professor" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <ProfessorAlunos />
                </ProtectedRoute>
            } />
            <Route path="/professor/alunos" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <ProfessorAlunos />
                </ProtectedRoute>
            } />
            <Route path="/professor/criar-treino" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <CriarTreino />
                </ProtectedRoute>
            } />
            <Route path="/professor/solicitacoes" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <Solicitacoes />
                </ProtectedRoute>
            } />
            <Route path="/professor/perfil" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <ProfessorPerfil />
                </ProtectedRoute>
            } />
            <Route path="/professor/feedbacks" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <ProfessorFeedbacks />
                </ProtectedRoute>
            } />

            {/* Aluno Routes */}
            <Route path="/aluno" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <MeuTreino />
                </ProtectedRoute>
            } />
            <Route path="/aluno/treino" element={
                <Navigate to="/aluno" replace />
            } />
            <Route path="/aluno/criar-treino" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <CriarMeuTreino />
                </ProtectedRoute>
            } />
            <Route path="/aluno/perfil" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <Perfil />
                </ProtectedRoute>
            } />
            <Route path="/aluno/feedback" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <AlunoFeedback />
                </ProtectedRoute>
            } />
            <Route path="/aluno/diario" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <DiarioTreino />
                </ProtectedRoute>
            } />
            <Route path="/aluno/iniciar-treino" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <IniciarTreino />
                </ProtectedRoute>
            } />
            <Route path="/aluno/evolucao" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <Evolucao />
                </ProtectedRoute>
            } />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default AppRoutes;
