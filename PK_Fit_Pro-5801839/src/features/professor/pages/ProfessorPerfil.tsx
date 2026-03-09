import { ProfessorLayout } from '../../../shared/components/layout';
import { useAuth } from '../../../shared/hooks/useAuth';
import ChangePassword from '../../../shared/components/ChangePassword';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/professor.css';
import { professorMenuItems as menuItems } from '../../../shared/config/professorMenu';

export default function ProfessorPerfil() {
    const { user } = useAuth();

    const getInitials = (name: string): string => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    return (
        <ProfessorLayout title="Meu Perfil" menuItems={menuItems}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
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
                <ChangePassword />
            </div>
        </ProfessorLayout>
    );
}
