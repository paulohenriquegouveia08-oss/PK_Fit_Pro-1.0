import { useState } from 'react';
import { supabase } from '../services/supabase';

// SVG eye icons
const EyeOpen = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
);

const EyeClosed = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
);

interface ChangePasswordProps {
    /** Optional custom title */
    title?: string;
}

export default function ChangePassword({ title = '🔒 Alterar Senha' }: ChangePasswordProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const resetForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        setMessage(null);
    };

    const handleSubmit = async () => {
        // Validate
        if (!currentPassword) {
            setMessage({ type: 'error', text: 'Informe a senha atual.' });
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }
        if (currentPassword === newPassword) {
            setMessage({ type: 'error', text: 'A nova senha deve ser diferente da atual.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            // First verify current password by re-signing in
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('Usuário não encontrado');

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                setMessage({ type: 'error', text: 'Senha atual incorreta.' });
                setIsSaving(false);
                return;
            }

            // Update password
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setMessage({ type: 'success', text: '✅ Senha alterada com sucesso!' });
            resetForm();
            setTimeout(() => setIsOpen(false), 2000);
        } catch (error: any) {
            setMessage({ type: 'error', text: error?.message || 'Erro ao alterar senha.' });
        }

        setIsSaving(false);
    };

    return (
        <div style={{
            background: 'var(--card-bg, #fff)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: 'var(--spacing-6)',
        }}>
            <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700,
                marginBottom: 'var(--spacing-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)'
            }}>
                Segurança
            </h3>

            {message && (
                <div className={`message-toast ${message.type}`} style={{ marginBottom: 'var(--spacing-4)' }}>
                    {message.text}
                </div>
            )}

            {!isOpen ? (
                <button
                    onClick={() => { setIsOpen(true); setMessage(null); }}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-2)',
                        transition: 'all 0.15s ease',
                    }}
                >
                    {title}
                </button>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                    {/* Current Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--spacing-1)',
                            color: 'var(--text-secondary)'
                        }}>
                            Senha Atual
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Digite sua senha atual"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                style={{ paddingRight: '44px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)', padding: 4,
                                    display: 'flex', alignItems: 'center',
                                }}
                                title={showCurrent ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {showCurrent ? <EyeClosed /> : <EyeOpen />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--spacing-1)',
                            color: 'var(--text-secondary)'
                        }}>
                            Nova Senha
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ paddingRight: '44px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)', padding: 4,
                                    display: 'flex', alignItems: 'center',
                                }}
                                title={showNew ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {showNew ? <EyeClosed /> : <EyeOpen />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--spacing-1)',
                            color: 'var(--text-secondary)'
                        }}>
                            Confirmar Nova Senha
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Repita a nova senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{ paddingRight: '44px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-secondary)', padding: 4,
                                    display: 'flex', alignItems: 'center',
                                }}
                                title={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {showConfirm ? <EyeClosed /> : <EyeOpen />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <small style={{ color: 'var(--error-500)', fontSize: '12px', marginTop: 4, display: 'block' }}>
                                As senhas não coincidem
                            </small>
                        )}
                        {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                            <small style={{ color: 'var(--success-500)', fontSize: '12px', marginTop: 4, display: 'block' }}>
                                ✅ Senhas coincidem
                            </small>
                        )}
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                        <button
                            className="btn-cancel"
                            onClick={() => { setIsOpen(false); resetForm(); }}
                            style={{ flex: 1 }}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn-add"
                            onClick={handleSubmit}
                            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
                            style={{ flex: 1 }}
                        >
                            {isSaving ? 'Salvando...' : 'Alterar Senha'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
