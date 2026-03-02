import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthState } from '../types';
import { getCurrentUser, logout as authLogout, clearLocalSession } from '../services/auth.service';
import { supabase } from '../services/supabase';

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

        // Listen for Supabase Auth state changes (e.g., token expiration, tab sync)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event) => {
                if (event === 'SIGNED_OUT') {
                    // Force local state to log out if the underlying token is invalidated
                    clearLocalSession();
                    setState({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false
                    });
                } else if (event === 'SIGNED_IN') {
                    refreshUser();
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const setUser = (user: User | null) => {
        setState({
            user,
            isAuthenticated: !!user,
            isLoading: false
        });
    };

    const logout = async () => {
        await authLogout();
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
