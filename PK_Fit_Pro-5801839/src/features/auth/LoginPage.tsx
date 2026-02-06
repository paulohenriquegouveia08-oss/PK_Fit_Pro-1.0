import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { checkEmail, createPassword, login } from '../../shared/services/auth.service';
import { getDashboardPath } from '../../app/guards';
import type { LoginStep } from '../../shared/types';
import './styles/login.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuth();

    const [step, setStep] = useState<LoginStep>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleEmailSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await checkEmail(email);

            if (!result.success) {
                setError(result.error || 'Erro ao verificar email');
                return;
            }

            if (!result.data?.exists) {
                setError('Email não encontrado');
                return;
            }

            // Check if user/academy is blocked
            if (result.data.isBlocked) {
                setError(result.data.blockReason || 'Acesso bloqueado');
                return;
            }

            // Email exists, check if has password
            if (result.data.hasPassword) {
                setStep('password');
            } else {
                setStep('create-password');
            }
        } catch {
            setError('Erro ao verificar email');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await login(email, password);

            if (!result.success) {
                setError(result.error || 'Erro ao fazer login');
                return;
            }

            if (result.data) {
                setUser(result.data);
                navigate(getDashboardPath(result.data.role));
            }
        } catch {
            setError('Erro ao fazer login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreatePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setIsLoading(true);

        try {
            const result = await createPassword(email, password);

            if (!result.success) {
                setError(result.error || 'Erro ao criar senha');
                return;
            }

            if (result.data) {
                setUser(result.data);
                navigate(getDashboardPath(result.data.role));
            }
        } catch {
            setError('Erro ao criar senha');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setStep('email');
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    const getStepTitle = () => {
        switch (step) {
            case 'email':
                return 'Entre com seu email';
            case 'password':
                return 'Digite sua senha';
            case 'create-password':
                return 'Crie sua senha';
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-logo">PK Fit Pro</h1>
                    <p className="login-subtitle">Sistema de Gestão para Academias</p>
                </div>

                <div className="login-step-indicator">
                    <span className={`step-dot ${step === 'email' ? 'active' : 'completed'}`}></span>
                    <span className={`step-dot ${step !== 'email' ? 'active' : ''}`}></span>
                </div>

                <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)', fontSize: 'var(--font-size-lg)' }}>
                    {getStepTitle()}
                </h2>

                {error && (
                    <div className="login-alert error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" />
                        </svg>
                        {error}
                    </div>
                )}

                {step === 'email' && (
                    <form className="login-form" onSubmit={handleEmailSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                className={`form-input ${error ? 'error' : ''}`}
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className={`btn btn-primary btn-full ${isLoading ? 'btn-loading' : ''}`}
                            disabled={isLoading || !email}
                        >
                            {isLoading ? '' : 'Continuar'}
                        </button>
                    </form>
                )}

                {step === 'password' && (
                    <form className="login-form" onSubmit={handlePasswordSubmit}>
                        <button type="button" className="back-button" onClick={handleBack}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10.828 12l4.95 4.95-1.414 1.414L8 12l6.364-6.364 1.414 1.414z" />
                            </svg>
                            Voltar
                        </button>
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Senha</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={`form-input ${error ? 'error' : ''}`}
                                    placeholder="Digite sua senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.882 19.297A10.949 10.949 0 0112 21c-5.392 0-9.878-3.88-10.819-9a10.982 10.982 0 013.34-6.066L1.392 2.808l1.415-1.415 19.799 19.8-1.415 1.414-3.31-3.31zM5.935 7.35A8.965 8.965 0 003.223 12a9.005 9.005 0 0013.2 5.838l-2.027-2.028A4.5 4.5 0 018.19 9.604L5.935 7.35zm6.979 6.978l-3.242-3.242a2.5 2.5 0 003.241 3.241zm7.893 2.264l-1.431-1.43A8.935 8.935 0 0020.777 12 9.005 9.005 0 009.552 5.338L7.974 3.76C9.221 3.27 10.58 3 12 3c5.392 0 9.878 3.88 10.819 9a10.947 10.947 0 01-2.012 4.592zm-9.084-9.084a4.5 4.5 0 014.769 4.769l-4.77-4.769z" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 3c5.392 0 9.878 3.88 10.819 9-.94 5.12-5.427 9-10.819 9-5.392 0-9.878-3.88-10.819-9C2.121 6.88 6.608 3 12 3zm0 16a9.005 9.005 0 008.777-7 9.005 9.005 0 00-17.554 0A9.005 9.005 0 0012 19zm0-2.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-2a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className={`btn btn-primary btn-full ${isLoading ? 'btn-loading' : ''}`}
                            disabled={isLoading || !password}
                        >
                            {isLoading ? '' : 'Entrar'}
                        </button>
                    </form>
                )}

                {step === 'create-password' && (
                    <form className="login-form" onSubmit={handleCreatePasswordSubmit}>
                        <button type="button" className="back-button" onClick={handleBack}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10.828 12l4.95 4.95-1.414 1.414L8 12l6.364-6.364 1.414 1.414z" />
                            </svg>
                            Voltar
                        </button>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-password">Criar senha</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="new-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Digite sua nova senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.882 19.297A10.949 10.949 0 0112 21c-5.392 0-9.878-3.88-10.819-9a10.982 10.982 0 013.34-6.066L1.392 2.808l1.415-1.415 19.799 19.8-1.415 1.414-3.31-3.31zM5.935 7.35A8.965 8.965 0 003.223 12a9.005 9.005 0 0013.2 5.838l-2.027-2.028A4.5 4.5 0 018.19 9.604L5.935 7.35zm6.979 6.978l-3.242-3.242a2.5 2.5 0 003.241 3.241zm7.893 2.264l-1.431-1.43A8.935 8.935 0 0020.777 12 9.005 9.005 0 009.552 5.338L7.974 3.76C9.221 3.27 10.58 3 12 3c5.392 0 9.878 3.88 10.819 9a10.947 10.947 0 01-2.012 4.592zm-9.084-9.084a4.5 4.5 0 014.769 4.769l-4.77-4.769z" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 3c5.392 0 9.878 3.88 10.819 9-.94 5.12-5.427 9-10.819 9-5.392 0-9.878-3.88-10.819-9C2.121 6.88 6.608 3 12 3zm0 16a9.005 9.005 0 008.777-7 9.005 9.005 0 00-17.554 0A9.005 9.005 0 0012 19zm0-2.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-2a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <span className="password-requirements">Mínimo de 6 caracteres</span>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="confirm-password">Confirmar senha</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    className={`form-input ${error && error.includes('coincidem') ? 'error' : ''}`}
                                    placeholder="Confirme sua senha"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showConfirmPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.882 19.297A10.949 10.949 0 0112 21c-5.392 0-9.878-3.88-10.819-9a10.982 10.982 0 013.34-6.066L1.392 2.808l1.415-1.415 19.799 19.8-1.415 1.414-3.31-3.31zM5.935 7.35A8.965 8.965 0 003.223 12a9.005 9.005 0 0013.2 5.838l-2.027-2.028A4.5 4.5 0 018.19 9.604L5.935 7.35zm6.979 6.978l-3.242-3.242a2.5 2.5 0 003.241 3.241zm7.893 2.264l-1.431-1.43A8.935 8.935 0 0020.777 12 9.005 9.005 0 009.552 5.338L7.974 3.76C9.221 3.27 10.58 3 12 3c5.392 0 9.878 3.88 10.819 9a10.947 10.947 0 01-2.012 4.592zm-9.084-9.084a4.5 4.5 0 014.769 4.769l-4.77-4.769z" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 3c5.392 0 9.878 3.88 10.819 9-.94 5.12-5.427 9-10.819 9-5.392 0-9.878-3.88-10.819-9C2.121 6.88 6.608 3 12 3zm0 16a9.005 9.005 0 008.777-7 9.005 9.005 0 00-17.554 0A9.005 9.005 0 0012 19zm0-2.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-2a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className={`btn btn-primary btn-full ${isLoading ? 'btn-loading' : ''}`}
                            disabled={isLoading || !password || !confirmPassword}
                        >
                            {isLoading ? '' : 'Criar senha e entrar'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
