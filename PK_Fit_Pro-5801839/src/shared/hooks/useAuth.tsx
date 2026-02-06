import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { getCurrentUser, logout as authLogout } from '../services/auth.service';

interface AuthContextType extends AuthState {
    setUser: (user: User | null) => void;
    logout: () => void;
    refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true
    });

    const refreshUser = () => {
        const user = getCurrentUser();
        setState({
            user,
            isAuthenticated: !!user,
            isLoading: false
        });
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const setUser = (user: User | null) => {
        setState({
            user,
            isAuthenticated: !!user,
            isLoading: false
        });
    };

    const logout = () => {
        authLogout();
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false
        });
    };

    return (
        <AuthContext.Provider value={{ ...state, setUser, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
