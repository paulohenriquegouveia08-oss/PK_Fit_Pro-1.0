import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import type { UserRole } from '../shared/types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

// Loading spinner component
function LoadingSpinner() {
    return (
        <div className="loading-container">
            <div className="spinner"></div>
            <p>Carregando...</p>
        </div>
    );
}

// Protected route - requires authentication
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (!isAuthenticated || !user) {
        // Redirect to login, save the attempted URL
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If specific roles are required, check them
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to the user's appropriate dashboard
        return <Navigate to={getDashboardPath(user.role)} replace />;
    }

    return <>{children}</>;
}

// Get dashboard path based on user role
export function getDashboardPath(role: UserRole): string {
    switch (role) {
        case 'ADMIN_GLOBAL':
            return '/admin-global';
        case 'ADMIN_ACADEMIA':
            return '/admin-academia';
        case 'PROFESSOR':
            return '/professor';
        case 'ALUNO':
            return '/aluno';
        default:
            return '/login';
    }
}

// Public route - redirects authenticated users to their dashboard
interface PublicRouteProps {
    children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (isAuthenticated && user) {
        return <Navigate to={getDashboardPath(user.role)} replace />;
    }

    return <>{children}</>;
}
