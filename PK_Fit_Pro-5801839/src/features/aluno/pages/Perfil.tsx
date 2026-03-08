import { useState, useEffect } from 'react';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentInfo, getStudentProfessor, getCurrentStudentId } from '../../../shared/services/student.service';
import { supabase } from '../../../shared/services/supabase';
import type { User } from '../../../shared/types';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

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
            <AlunoLayout title="Meu Perfil" menuItems={menuItems}>
                <div className="profile-page">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando perfil...</p>
                    </div>
                </div>
            </AlunoLayout>
        );
    }

    return (
        <AlunoLayout title="Meu Perfil" menuItems={menuItems}>
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
        </AlunoLayout>
    );
}
