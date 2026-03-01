import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getExpiringStudentPlans } from '../../services/membershipAlert.service';
import { getCurrentAcademyId } from '../../services/academyMember.service';
import type { UserRole } from '../../types';
import './layout.css';

interface MenuItem {
    label: string;
    path: string;
    icon: ReactNode;
}

interface DashboardLayoutProps {
    children: ReactNode;
    title: string;
    menuItems: MenuItem[];
}

export function DashboardLayout({ children, title, menuItems }: DashboardLayoutProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [expiringCount, setExpiringCount] = useState(0);

    // Fetch expiring plans
    useEffect(() => {
        const fetchAlerts = async () => {
            if (user?.role === 'ADMIN_ACADEMIA' || user?.role === 'ADMIN_GLOBAL') {
                const academyId = getCurrentAcademyId();
                if (academyId) {
                    const res = await getExpiringStudentPlans(academyId);
                    if (res.success && res.data) {
                        const totalVencendo = res.data.length;
                        // Check if acknowledged
                        const storageKey = `ack_mensalidades_${user.id}_${academyId}`;
                        const ackData = localStorage.getItem(storageKey);
                        if (ackData) {
                            try {
                                const parsed = JSON.parse(ackData);
                                // If the number of expiring plans is different than what was acknowledged, show the badge again
                                if (parsed.count !== totalVencendo) {
                                    setExpiringCount(totalVencendo);
                                } else {
                                    setExpiringCount(0);
                                }
                            } catch (e) {
                                setExpiringCount(totalVencendo);
                            }
                        } else {
                            setExpiringCount(totalVencendo);
                        }
                    }
                }
            }
        };
        fetchAlerts();
    }, [user]);

    // Clear badge when visiting the route
    useEffect(() => {
        if (location.pathname.includes('/mensalidades-vencendo') && expiringCount > 0) {
            const academyId = getCurrentAcademyId();
            if (user?.id && academyId) {
                const storageKey = `ack_mensalidades_${user.id}_${academyId}`;
                localStorage.setItem(storageKey, JSON.stringify({ count: expiringCount, date: new Date().toISOString() }));
                setExpiringCount(0);
            }
        }
    }, [location.pathname, expiringCount, user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getRoleLabel = (role: UserRole): string => {
        const labels: Record<UserRole, string> = {
            'ADMIN_GLOBAL': 'Admin Global',
            'ADMIN_ACADEMIA': 'Admin Academia',
            'PROFESSOR': 'Professor',
            'ALUNO': 'Aluno'
        };
        return labels[role] || role;
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
        <div className="dashboard-layout">
            {/* Sidebar Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                        </div>
                        PK Fit Pro
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Menu</div>
                        <ul className="sidebar-menu">
                            {menuItems.map((item) => (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        {item.icon}
                                        {item.label}
                                        {item.label === 'Mensalidades' && expiringCount > 0 && (
                                            <span className="menu-badge">{expiringCount}</span>
                                        )}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-menu">
                        <div className="user-avatar">
                            {user && getInitials(user.name)}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{user?.name}</div>
                            <div className="user-role">{user && getRoleLabel(user.role)}</div>
                        </div>
                        <button className="logout-btn" onClick={handleLogout} title="Sair">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5 22a1 1 0 01-1-1V3a1 1 0 011-1h14a1 1 0 011 1v3h-2V4H6v16h12v-2h2v3a1 1 0 01-1 1H5zm13-6v-3h-7v-2h7V8l5 4-5 4z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="main-header">
                    <button
                        className="mobile-menu-btn"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
                        </svg>
                    </button>
                    <h1 className="page-title">{title}</h1>
                    <div className="header-actions">
                        {/* Notifications and other actions can go here */}
                    </div>
                </header>
                <div className="main-container">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
