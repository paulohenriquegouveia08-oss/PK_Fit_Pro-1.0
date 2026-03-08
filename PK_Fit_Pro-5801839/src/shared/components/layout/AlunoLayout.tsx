import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './aluno-layout.css';

interface AlunoMenuItem {
    label: string;
    path: string;
    icon: ReactNode;
    isCenter?: boolean;
}

interface AlunoLayoutProps {
    children: ReactNode;
    title?: string;
    menuItems: AlunoMenuItem[];
}

export function AlunoLayout({ children, title, menuItems }: AlunoLayoutProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string): string => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <div className="aluno-layout">
            {/* Header */}
            <header className="aluno-header">
                <a href="/aluno" className="aluno-header-logo">
                    <div className="aluno-header-logo-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                            <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                        </svg>
                    </div>
                    PK Fit Pro
                </a>

                <div className="aluno-header-right">
                    <div className="aluno-header-user">
                        <div className="aluno-header-avatar">
                            {user && getInitials(user.name)}
                        </div>
                        <span className="aluno-header-name">{user?.name}</span>
                    </div>
                    <button className="aluno-logout-btn" onClick={handleLogout} title="Sair">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 22a1 1 0 01-1-1V3a1 1 0 011-1h14a1 1 0 011 1v3h-2V4H6v16h12v-2h2v3a1 1 0 01-1 1H5zm13-6v-3h-7v-2h7V8l5 4-5 4z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="aluno-main">
                <div className="aluno-main-container">
                    {title && <h1 className="aluno-page-title">{title}</h1>}
                    {children}
                </div>
            </main>

            {/* Bottom Navbar */}
            <nav className="aluno-bottom-nav">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/aluno'}
                        className={({ isActive }) =>
                            `aluno-nav-item ${item.isCenter ? 'center' : ''} ${isActive ? 'active' : ''}`
                        }
                    >
                        {item.isCenter ? (
                            <>
                                <div className="aluno-nav-center-glow" />
                                <div className="aluno-nav-center-btn">
                                    {item.icon}
                                </div>
                                <span className="aluno-nav-center-label">{item.label}</span>
                            </>
                        ) : (
                            <>
                                {item.icon}
                                <span>{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}

export default AlunoLayout;
