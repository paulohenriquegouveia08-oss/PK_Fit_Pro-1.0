import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';
import { getSystemStorageReport, type StorageReport } from '../../../shared/services/academy.service';
import '../styles/dashboard.css';
import '../styles/academias.css';
import '../styles/usuarios.css'; // reaproveitar estilos de empty state se precisar

export default function OcupacaoDados() {
    const [reports, setReports] = useState<StorageReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Soma total pra dar uma visão geral
    const totalStorageMb = reports.reduce((acc, r) => acc + r.estimatedStorageMb, 0);
    const totalDatabaseMb = reports.reduce((acc, r) => acc + r.estimatedDatabaseMb, 0);
    const totalDataMb = totalStorageMb + totalDatabaseMb;

    useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            const res = await getSystemStorageReport();
            if (res.success && res.data) {
                setReports(res.data);
            } else {
                setError(res.error || 'Erro desconhecido ao carregar os relatórios.');
            }
            setIsLoading(false);
        };
        fetchReports();
    }, []);

    const maxUsageMb = reports.length > 0 ? Math.max(...reports.map(r => r.estimatedStorageMb + r.estimatedDatabaseMb)) : 1;

    return (
        <DashboardLayout title="Uso de Dados" menuItems={menuItems}>
            <div className="admin-global-dashboard" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div className="page-header" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <h2>Ocupação do Banco e Armazenamento</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Métricas reais processadas com base em volumetria média.</p>
                </div>

                {/* Resumo Global */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--spacing-4)',
                    marginBottom: 'var(--spacing-8)'
                }}>
                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))' }}>
                        <div className="stat-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Armazenamento Total (Fotos)</div>
                        <div className="stat-value" style={{ color: 'white' }}>{totalStorageMb.toFixed(2)} MB</div>
                        <div className="stat-trend" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Baseado em {reports.reduce((a, r) => a + r.totalPhotos, 0)} fotos
                        </div>
                    </div>
                    
                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--warning-500), var(--warning-700))' }}>
                        <div className="stat-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Banco de Dados Total</div>
                        <div className="stat-value" style={{ color: 'white' }}>{totalDatabaseMb.toFixed(2)} MB</div>
                        <div className="stat-trend" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Baseado em {reports.reduce((a, r) => a + r.totalStudents + r.totalProfessors, 0)} usuários
                        </div>
                    </div>

                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--success-600), var(--success-800))' }}>
                        <div className="stat-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Volume Geral Trafegado</div>
                        <div className="stat-value" style={{ color: 'white' }}>{totalDataMb.toFixed(2)} MB</div>
                        <div className="stat-trend" style={{ color: 'rgba(255,255,255,0.9)' }}>Ocupação Lógica</div>
                    </div>
                </div>

                {/* Relatórios Individuais */}
                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Consumo por Academia</h2>
                    </div>

                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Analisando banco de dados inteiro...</p>
                        </div>
                    ) : error ? (
                        <div className="message-toast error">{error}</div>
                    ) : reports.length === 0 ? (
                        <div className="empty-state">Nenhuma academia cadastrada.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                            {reports.map((report) => {
                                const localTotalMb = report.estimatedStorageMb + report.estimatedDatabaseMb;
                                const barWidth = Math.max((localTotalMb / maxUsageMb) * 100, 2); // min 2% pra ver a barra
                                return (
                                    <div key={report.academyId} style={{
                                        background: 'var(--bg-tertiary)',
                                        padding: 'var(--spacing-4)',
                                        borderRadius: 'var(--radius-lg)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--spacing-3)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{report.academyName}</h3>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{localTotalMb.toFixed(2)} MB</div>
                                        </div>
                                        
                                        {/* Barra de Progresso Misto */}
                                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                                            <div style={{ 
                                                width: `${barWidth}%`, 
                                                background: 'var(--primary-500)', 
                                                height: '100%',
                                                transition: 'width 1s ease-out'
                                            }} />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-1)' }}>
                                            <div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Alunos</div>
                                                <div style={{ fontWeight: 500 }}>{report.totalStudents}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Professores</div>
                                                <div style={{ fontWeight: 500 }}>{report.totalProfessors}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Fotos Cadastradas</div>
                                                <div style={{ fontWeight: 500 }}>{report.totalPhotos} <span style={{fontSize: '10px', color: 'var(--text-secondary)'}}>({report.estimatedStorageMb} MB)</span></div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Peso Tabela (BD)</div>
                                                <div style={{ fontWeight: 500 }}>~{report.estimatedDatabaseMb} MB</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </DashboardLayout>
    );
}
