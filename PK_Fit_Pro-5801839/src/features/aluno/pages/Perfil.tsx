import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentStudentInfo, getStudentProfessor, getCurrentStudentId } from '../../../shared/services/student.service';
import { supabase } from '../../../shared/services/supabase';
import type { User } from '../../../shared/types';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';

const menuItems = [
    {
        label: 'Dashboard',
        path: '/aluno',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
    },
    {
        label: 'Meu Treino',
        path: '/aluno/treino',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" /></svg>
    },
    {
        label: 'Meu Perfil',
        path: '/aluno/perfil',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
    }
];

export default function Perfil() {
    const [user, setUser] = useState<User | null>(null);
    const [professor, setProfessor] = useState<{ name: string; email: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        const loadProfile = async () => {
            const studentInfo = getCurrentStudentInfo();
            if (studentInfo) {
                setUser(studentInfo);
                setName(studentInfo.name || '');
                setPhone(studentInfo.phone || '');

                // Get professor info
                const studentId = getCurrentStudentId();
                if (studentId) {
                    const profResult = await getStudentProfessor(studentId);
                    if (profResult.success && profResult.data) {
                        setProfessor(profResult.data);
                    }
                }
            }
            setIsLoading(false);
        };
        loadProfile();
    }, []);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    name: name,
                    phone: phone || null
                })
                .eq('id', user.id);

            if (error) throw error;

            // Update local storage using the storage service
            const updatedUser = { ...user, name, phone };
            // Re-import and update the session
            const { setStorageItem, STORAGE_KEYS, EXPIRATION } = await import('../../../shared/services/storage.service');
            setStorageItem(STORAGE_KEYS.USER_SESSION, updatedUser, EXPIRATION.SESSION_MINUTES, updatedUser.id);
            setUser(updatedUser);

            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Erro ao atualizar perfil' });
        }

        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <DashboardLayout title="Meu Perfil" menuItems={menuItems}>
                <div className="profile-page">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando perfil...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Meu Perfil" menuItems={menuItems}>
            <div className="profile-page">
                <div className="profile-card">
                    <div className="profile-header">
                        <div className="profile-avatar">
                            {user ? getInitials(user.name) : '??'}
                        </div>
                        <div className="profile-info">
                            <h2>{user?.name || 'Usuário'}</h2>
                            <p>{user?.email}</p>
                            <span className={`status-badge ${user?.is_active ? 'active' : 'inactive'}`}>
                                {user?.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                    </div>

                    {message && (
                        <div className={`message-toast ${message.type}`} style={{ marginBottom: 'var(--spacing-4)' }}>
                            {message.text}
                        </div>
                    )}

                    <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <div className="form-group">
                            <label className="form-label">Nome Completo</label>
                            <input
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={user?.email || ''}
                                disabled
                            />
                            <small style={{ color: 'var(--text-tertiary)' }}>O email não pode ser alterado</small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefone</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Membro desde</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formatDate(user?.created_at)}
                                disabled
                            />
                        </div>
                    </form>

                    {/* Professor Info */}
                    {professor && (
                        <div className="professor-info-card">
                            <h4>Seu Professor</h4>
                            <div className="professor-details">
                                <div className="professor-avatar">{getInitials(professor.name)}</div>
                                <div>
                                    <strong>{professor.name}</strong>
                                    <p>{professor.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 'var(--spacing-6)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-add" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
