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
    Alunos as AdminAcademiaAlunos
} from '../features/adminAcademia';

// Professor
import {
    Dashboard as ProfessorDashboard,
    Alunos as ProfessorAlunos,
    CriarTreino,
    Solicitacoes
} from '../features/professor';

// Aluno
import {
    Dashboard as AlunoDashboard,
    MeuTreino,
    Perfil
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

            {/* Professor Routes */}
            <Route path="/professor" element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                    <ProfessorDashboard />
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

            {/* Aluno Routes */}
            <Route path="/aluno" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <AlunoDashboard />
                </ProtectedRoute>
            } />
            <Route path="/aluno/treino" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <MeuTreino />
                </ProtectedRoute>
            } />
            <Route path="/aluno/perfil" element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                    <Perfil />
                </ProtectedRoute>
            } />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default AppRoutes;
