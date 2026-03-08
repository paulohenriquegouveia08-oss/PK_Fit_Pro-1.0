import { useState } from 'react';
import { ProfessorLayout } from '../../../shared/components/layout';
import { useAuth } from '../../../shared/hooks/useAuth';
import { supabase } from '../../../shared/services/supabase';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/professor.css';
import { professorMenuItems as menuItems } from '../../../shared/config/professorMenu';

export default function ProfessorPerfil() {
    const { user } = useAuth();
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const getInitials = (name: string): string => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setNewPassword('');
            setConfirmPassword('');
            setIsChangingPassword(false);
        } catch (error: any) {
            setMessage({ type: 'error', text: error?.message || 'Erro ao alterar senha.' });
        }

        setIsSaving(false);
    };

    return (
        <ProfessorLayout title="Meu Perfil" menuItems={menuItems}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* Profile Card */}
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    padding: 'var(--spacing-6)',
                    textAlign: 'center',
                    marginBottom: 'var(--spacing-6)'
                }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '28px',
                        margin: '0 auto var(--spacing-4)'
                    }}>
                        {user && getInitials(user.name)}
                    </div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-xl)' }}>{user?.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>{user?.email}</p>
                    <span style={{
                        display: 'inline-block', marginTop: 'var(--spacing-3)',
                        padding: '4px 16px', borderRadius: 'var(--radius-full)',
                        background: 'var(--primary-50)', color: 'var(--primary-700)',
                        fontSize: 'var(--font-size-xs)', fontWeight: 600
                    }}>
                        Professor
                    </span>
                </div>

                {/* Info Card */}
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    padding: 'var(--spacing-6)',
                    marginBottom: 'var(--spacing-6)'
                }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)' }}>
                        Informações
                    </h3>
                    <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Nome</span>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{user?.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Email</span>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{user?.email}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Função</span>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Professor</span>
                        </div>
                    </div>
                </div>

                {/* Change Password */}
                <div style={{
                    background: 'var(--card-bg, #fff)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    padding: 'var(--spacing-6)'
                }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)' }}>
                        Segurança
                    </h3>

                    {!isChangingPassword ? (
                        <button
                            onClick={() => setIsChangingPassword(true)}
                            style={{
                                width: '100%', padding: 'var(--spacing-3)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'transparent', cursor: 'pointer',
                                fontWeight: 600, fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)'
                            }}
                        >
                            🔒 Alterar Senha
                        </button>
                    ) : (
                        <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Nova senha"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Confirmar nova senha"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                <button className="btn-cancel" onClick={() => {
                                    setIsChangingPassword(false);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }} style={{ flex: 1 }}>
                                    Cancelar
                                </button>
                                <button className="btn-add" onClick={handleChangePassword} disabled={isSaving} style={{ flex: 1 }}>
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProfessorLayout>
    );
}
