import { useState, useEffect, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import {
    getLoadEvolution,
    getRepsEvolution,
    getTrainingFrequency,
    getStudentExercises,
    generateInsights,
    PERIOD_OPTIONS,
    type LoadEvolutionPoint,
    type RepsEvolutionPoint,
    type FrequencyDay,
    type AnalysisInsight
} from '../../../shared/services/evolution.service';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/aluno.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, Title, Tooltip, Legend, Filler
);

// ─── Chart Colors ───
const COLORS = {
    primary: 'rgb(99, 102, 241)',
    primaryAlpha: 'rgba(99, 102, 241, 0.15)',
    secondary: 'rgb(245, 158, 11)',
    secondaryAlpha: 'rgba(245, 158, 11, 0.15)',
    success: 'rgb(34, 197, 94)',
    successAlpha: 'rgba(34, 197, 94, 0.15)',
    danger: 'rgb(239, 68, 68)',
    neutral: 'rgb(148, 163, 184)',
    bg: 'rgb(241, 245, 249)',
};

const chartPalette = [
    'rgb(99, 102, 241)', 'rgb(245, 158, 11)', 'rgb(34, 197, 94)',
    'rgb(239, 68, 68)', 'rgb(168, 85, 247)', 'rgb(14, 165, 233)',
    'rgb(236, 72, 153)', 'rgb(20, 184, 166)'
];

// ─── Helpers ───
const fmtDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
};
const fmtDateFull = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
};

// ─── Shared chart options ───
const baseLineOpts = (yLabel: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
        legend: { position: 'top' as const, labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 8,
            displayColors: true
        }
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#94a3b8', maxRotation: 45 }
        },
        y: {
            beginAtZero: true,
            title: { display: true, text: yLabel, font: { size: 11 }, color: '#64748b' },
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: { font: { size: 10 }, color: '#94a3b8' }
        }
    }
});

export default function Evolucao() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- Module 1: Load Evolution ---
    const [loadPeriod, setLoadPeriod] = useState(30);
    const [loadMode, setLoadMode] = useState<'volume' | 'max'>('volume');
    const [loadData, setLoadData] = useState<LoadEvolutionPoint[]>([]);
    const [loadLoading, setLoadLoading] = useState(false);
    const [selectedExerciseLoad, setSelectedExerciseLoad] = useState<string>('');

    // --- Module 2: Reps Evolution ---
    const [repsPeriod, setRepsPeriod] = useState(30);
    const [repsExercise, setRepsExercise] = useState<string>('');
    const [repsData, setRepsData] = useState<RepsEvolutionPoint[]>([]);
    const [repsLoading, setRepsLoading] = useState(false);

    // --- Module 3: Frequency ---
    const [freqPeriod, setFreqPeriod] = useState(30);
    const [freqMode, setFreqMode] = useState<'monthly' | 'weekly'>('monthly');
    const [freqData, setFreqData] = useState<FrequencyDay[]>([]);
    const [freqLoading, setFreqLoading] = useState(false);

    // --- Exercises list ---
    const [exercises, setExercises] = useState<string[]>([]);

    // --- Insights ---
    const [insights, setInsights] = useState<AnalysisInsight[]>([]);

    // --- Active section ---
    const [activeSection, setActiveSection] = useState<1 | 2 | 3>(1);

    // Init
    useEffect(() => {
        const sId = getCurrentStudentId();
        if (!sId) { setIsLoading(false); return; }
        setStudentId(sId);
        getStudentExercises(sId).then(exs => {
            setExercises(exs);
            if (exs.length > 0) setRepsExercise(exs[0]);
        });
        setIsLoading(false);
    }, []);

    // Load evolution data
    useEffect(() => {
        if (!studentId) return;
        setLoadLoading(true);
        getLoadEvolution(studentId, loadPeriod, selectedExerciseLoad || undefined)
            .then(d => { setLoadData(d); setLoadLoading(false); })
            .catch(() => setLoadLoading(false));
    }, [studentId, loadPeriod, selectedExerciseLoad]);

    // Reps evolution data
    useEffect(() => {
        if (!studentId || !repsExercise) return;
        setRepsLoading(true);
        getRepsEvolution(studentId, repsExercise, repsPeriod)
            .then(d => { setRepsData(d); setRepsLoading(false); })
            .catch(() => setRepsLoading(false));
    }, [studentId, repsExercise, repsPeriod]);

    // Frequency data
    useEffect(() => {
        if (!studentId) return;
        setFreqLoading(true);
        getTrainingFrequency(studentId, freqPeriod)
            .then(d => { setFreqData(d); setFreqLoading(false); })
            .catch(() => setFreqLoading(false));
    }, [studentId, freqPeriod]);

    // Insights
    useEffect(() => {
        if (loadData.length > 0 || freqData.length > 0) {
            setInsights(generateInsights(loadData, freqData, loadPeriod));
        }
    }, [loadData, freqData, loadPeriod]);

    // ────── CHART DATA ──────

    // Module 1: Load chart
    const loadChartData = useMemo(() => {
        if (loadData.length === 0) return null;

        // Group by exercise
        const byExercise = new Map<string, LoadEvolutionPoint[]>();
        for (const p of loadData) {
            if (!byExercise.has(p.exercise_name)) byExercise.set(p.exercise_name, []);
            byExercise.get(p.exercise_name)!.push(p);
        }

        // Get unique dates sorted
        const dates = [...new Set(loadData.map(p => p.date))].sort();
        const labels = dates.map(fmtDate);

        const datasets = Array.from(byExercise.entries()).map(([name, points], i) => {
            const dateMap = new Map(points.map(p => [p.date, p]));
            const color = chartPalette[i % chartPalette.length];
            return {
                label: name,
                data: dates.map(d => {
                    const pt = dateMap.get(d);
                    return pt ? (loadMode === 'volume' ? pt.total_volume : pt.max_load) : null;
                }),
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
                tension: 0.3,
                fill: false,
                pointRadius: 3,
                pointHoverRadius: 6,
                borderWidth: 2,
                spanGaps: true
            };
        });

        return { labels, datasets };
    }, [loadData, loadMode]);

    // Module 2: Reps chart
    const repsChartData = useMemo(() => {
        if (repsData.length === 0) return null;
        const labels = repsData.map(p => fmtDate(p.date));
        return {
            labels,
            datasets: [
                {
                    label: 'Melhor Reps',
                    data: repsData.map(p => p.best_reps),
                    borderColor: COLORS.primary,
                    backgroundColor: COLORS.primaryAlpha,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Carga (kg)',
                    data: repsData.map(p => p.load_at_best),
                    borderColor: COLORS.secondary,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                }
            ]
        };
    }, [repsData]);

    // Module 3: Frequency chart (bar)
    const freqChartData = useMemo(() => {
        if (freqData.length === 0) return null;

        if (freqMode === 'weekly') {
            // Group by week
            const weeks: { label: string; trained: number; total: number }[] = [];
            for (let i = 0; i < freqData.length; i += 7) {
                const week = freqData.slice(i, i + 7);
                const trained = week.filter(d => d.trained).length;
                const startLabel = fmtDate(week[0].date);
                weeks.push({ label: `Sem ${startLabel}`, trained, total: week.length });
            }
            return {
                labels: weeks.map(w => w.label),
                datasets: [{
                    label: 'Dias Treinados',
                    data: weeks.map(w => w.trained),
                    backgroundColor: weeks.map(w => w.trained >= 4 ? COLORS.success : w.trained >= 2 ? COLORS.secondary : COLORS.danger),
                    borderRadius: 6,
                    maxBarThickness: 40
                }]
            };
        } else {
            // Daily view — last 30 days
            const last30 = freqData.slice(-30);
            return {
                labels: last30.map(d => fmtDate(d.date)),
                datasets: [{
                    label: 'Treinou',
                    data: last30.map(d => d.trained ? 1 : 0),
                    backgroundColor: last30.map(d => d.trained ? COLORS.success : 'rgba(148, 163, 184, 0.15)'),
                    borderRadius: 4,
                    maxBarThickness: 20
                }]
            };
        }
    }, [freqData, freqMode]);

    // ────── FREQUENCY STATS ──────
    const freqStats = useMemo(() => {
        const total = freqData.length;
        const trained = freqData.filter(d => d.trained).length;
        const pct = total > 0 ? Math.round((trained / total) * 100) : 0;
        const last7 = freqData.slice(-7);
        const last7Trained = last7.filter(d => d.trained).length;
        return { total, trained, pct, last7Trained, last7Total: last7.length };
    }, [freqData]);

    // ────── STYLES ──────
    const cardStyle: React.CSSProperties = {
        background: 'var(--background-primary, #fff)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
    };
    const sectionHeaderStyle = (isActive: boolean): React.CSSProperties => ({
        padding: 'var(--spacing-3) var(--spacing-4)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: isActive ? 'linear-gradient(135deg, var(--primary-50), var(--primary-100))' : 'var(--background-primary)',
        borderBottom: isActive ? '1px solid var(--border-color)' : 'none',
        transition: 'all 0.2s'
    });
    const pillStyle = (active: boolean): React.CSSProperties => ({
        padding: '6px 14px',
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        background: active ? 'var(--primary-500)' : 'var(--background-secondary)',
        color: active ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.15s'
    });
    const selectStyle: React.CSSProperties = {
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'inherit',
        background: 'var(--background-primary)',
        color: 'var(--text-primary)',
        cursor: 'pointer'
    };
    const chartContainer: React.CSSProperties = {
        position: 'relative',
        height: 300,
        padding: 'var(--spacing-3) var(--spacing-4)',
    };
    const spinnerBlock = (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <div className="spinner" />
        </div>
    );
    const emptyBlock = (msg: string) => (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-6)', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--spacing-2)', opacity: 0.4 }}>📊</div>
            <p style={{ fontSize: 'var(--font-size-sm)' }}>{msg}</p>
        </div>
    );

    if (isLoading) {
        return (
            <AlunoLayout title="Evolução" menuItems={menuItems}>
                <div className="loading-state"><div className="spinner" /><p>Carregando...</p></div>
            </AlunoLayout>
        );
    }

    return (
        <AlunoLayout title="Evolução" menuItems={menuItems}>
            <div style={{ padding: 0 }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--spacing-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                        📈 Área de Evolução
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Acompanhe sua evolução de carga, repetições e consistência
                    </p>
                </div>

                {/* ═══ INSIGHTS CARDS ═══ */}
                {insights.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 'var(--spacing-3)',
                        marginBottom: 'var(--spacing-5)'
                    }}>
                        {insights.map((insight, i) => (
                            <div key={i} style={{
                                ...cardStyle,
                                padding: 'var(--spacing-3) var(--spacing-4)',
                                borderLeft: `4px solid ${insight.type === 'positive' ? COLORS.success : insight.type === 'negative' ? COLORS.danger : COLORS.secondary}`,
                                display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-2)'
                            }}>
                                <span style={{ fontSize: 20, flexShrink: 0 }}>{insight.icon}</span>
                                <p style={{ fontSize: 'var(--font-size-xs)', lineHeight: 1.5, color: 'var(--text-primary)', margin: 0 }}>
                                    {insight.text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* ═══ MODULE 1: EVOLUÇÃO DE CARGA ═══ */}
                {/* ═══════════════════════════════════════════ */}
                <div style={{ ...cardStyle, marginBottom: 'var(--spacing-4)' }}>
                    <div style={sectionHeaderStyle(activeSection === 1)} onClick={() => setActiveSection(activeSection === 1 ? 1 : 1)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <span style={{ fontSize: 18 }}>🏋️</span>
                            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Evolução de Carga</strong>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-secondary)" style={{ transform: activeSection === 1 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                        </svg>
                    </div>

                    {activeSection === 1 && (
                        <div>
                            {/* Filters */}
                            <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>Período:</span>
                                {PERIOD_OPTIONS.map(p => (
                                    <button key={p.value} style={pillStyle(loadPeriod === p.value)} onClick={() => setLoadPeriod(p.value)}>
                                        {p.label}
                                    </button>
                                ))}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                    <select style={selectStyle} value={selectedExerciseLoad} onChange={e => setSelectedExerciseLoad(e.target.value)}>
                                        <option value="">Todos exercícios</option>
                                        {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                    </select>
                                    <button style={pillStyle(loadMode === 'volume')} onClick={() => setLoadMode('volume')}>Volume</button>
                                    <button style={pillStyle(loadMode === 'max')} onClick={() => setLoadMode('max')}>Carga Máx</button>
                                </div>
                            </div>

                            {/* Chart */}
                            {loadLoading ? spinnerBlock : loadChartData ? (
                                <div style={chartContainer}>
                                    <Line data={loadChartData} options={baseLineOpts(loadMode === 'volume' ? 'Volume (kg × reps)' : 'Carga Máxima (kg)')} />
                                </div>
                            ) : emptyBlock('Nenhum dado de carga encontrado para o período selecionado. Complete treinos para ver sua evolução!')}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* ═══ MODULE 2: EVOLUÇÃO DE REPS ═══ */}
                {/* ═══════════════════════════════════════════ */}
                <div style={{ ...cardStyle, marginBottom: 'var(--spacing-4)' }}>
                    <div style={sectionHeaderStyle(activeSection === 2)} onClick={() => setActiveSection(2)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <span style={{ fontSize: 18 }}>🔄</span>
                            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Evolução de Repetições</strong>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-secondary)" style={{ transform: activeSection === 2 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                        </svg>
                    </div>

                    {activeSection === 2 && (
                        <div>
                            {/* Filters */}
                            <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>Exercício:</span>
                                <select style={{ ...selectStyle, minWidth: 180 }} value={repsExercise} onChange={e => setRepsExercise(e.target.value)}>
                                    {exercises.length === 0 && <option value="">Nenhum exercício</option>}
                                    {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                </select>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600, marginLeft: 'var(--spacing-2)' }}>Período:</span>
                                {PERIOD_OPTIONS.map(p => (
                                    <button key={p.value} style={pillStyle(repsPeriod === p.value)} onClick={() => setRepsPeriod(p.value)}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Chart */}
                            {repsLoading ? spinnerBlock : repsChartData ? (
                                <div style={chartContainer}>
                                    {/* Custom split legend: Reps left, Carga right */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--spacing-2)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.primary, display: 'inline-block' }} />
                                            Melhor Reps (eixo esquerdo)
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                            Carga em kg (eixo direito)
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.secondary, display: 'inline-block' }} />
                                        </span>
                                    </div>
                                    <Line
                                        data={repsChartData}
                                        options={{
                                            ...baseLineOpts('Repetições'),
                                            scales: {
                                                ...baseLineOpts('Repetições').scales,
                                                y1: {
                                                    type: 'linear' as const,
                                                    position: 'right' as const,
                                                    beginAtZero: true,
                                                    title: { display: true, text: 'Carga (kg)', font: { size: 11 }, color: COLORS.secondary },
                                                    grid: { display: false },
                                                    ticks: { font: { size: 10 }, color: COLORS.secondary }
                                                }
                                            },
                                            plugins: {
                                                ...baseLineOpts('Repetições').plugins,
                                                legend: { display: false },
                                                tooltip: {
                                                    ...baseLineOpts('Repetições').plugins.tooltip,
                                                    callbacks: {
                                                        afterBody: (ctx: any) => {
                                                            const idx = ctx[0]?.dataIndex;
                                                            if (idx !== undefined && repsData[idx]) {
                                                                return [
                                                                    `📅 ${fmtDateFull(repsData[idx].date)}`,
                                                                    `Média Reps: ${repsData[idx].avg_reps}`,
                                                                    `Média Carga: ${repsData[idx].avg_load} kg`
                                                                ];
                                                            }
                                                            return [];
                                                        }
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            ) : emptyBlock('Selecione um exercício e complete treinos para ver a evolução de repetições.')}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* ═══ MODULE 3: CONSISTÊNCIA ═══ */}
                {/* ═══════════════════════════════════════════ */}
                <div style={{ ...cardStyle, marginBottom: 'var(--spacing-4)' }}>
                    <div style={sectionHeaderStyle(activeSection === 3)} onClick={() => setActiveSection(3)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <span style={{ fontSize: 18 }}>📅</span>
                            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Consistência de Treino</strong>
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-secondary)" style={{ transform: activeSection === 3 ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                        </svg>
                    </div>

                    {activeSection === 3 && (
                        <div>
                            {/* Filters */}
                            <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>Período:</span>
                                {PERIOD_OPTIONS.slice(0, 3).map(p => (
                                    <button key={p.value} style={pillStyle(freqPeriod === p.value)} onClick={() => setFreqPeriod(p.value)}>
                                        {p.label}
                                    </button>
                                ))}
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-2)' }}>
                                    <button style={pillStyle(freqMode === 'monthly')} onClick={() => setFreqMode('monthly')}>Mensal</button>
                                    <button style={pillStyle(freqMode === 'weekly')} onClick={() => setFreqMode('weekly')}>Semanal</button>
                                </div>
                            </div>

                            {/* Summary cards */}
                            <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-3)' }}>
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-2)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Dias Treinados</div>
                                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: COLORS.success }}>{freqStats.trained}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>de {freqStats.total} dias</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-2)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Frequência</div>
                                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: freqStats.pct >= 50 ? COLORS.success : COLORS.secondary }}>{freqStats.pct}%</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>do período</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-2)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Última Semana</div>
                                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: freqStats.last7Trained >= 4 ? COLORS.success : COLORS.secondary }}>{freqStats.last7Trained}/{freqStats.last7Total}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>dias</div>
                                </div>
                            </div>

                            {/* Calendar Heatmap */}
                            {freqLoading ? spinnerBlock : freqData.length > 0 ? (
                                <>
                                    {/* Visual calendar grid */}
                                    <div style={{ padding: 'var(--spacing-2) var(--spacing-4)' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                            {freqData.slice(-42).map((day, i) => {
                                                const isToday = day.date === new Date().toISOString().split('T')[0];
                                                return (
                                                    <div
                                                        key={i}
                                                        title={`${fmtDateFull(day.date)} — ${day.trained ? 'Treinou ✅' : 'Não treinou'}`}
                                                        style={{
                                                            width: 22, height: 22,
                                                            borderRadius: 4,
                                                            background: day.trained ? COLORS.success : 'var(--background-secondary)',
                                                            border: isToday ? `2px solid ${COLORS.primary}` : '1px solid var(--border-color)',
                                                            cursor: 'default',
                                                            transition: 'transform 0.1s',
                                                            opacity: day.trained ? 1 : 0.4
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.success, display: 'inline-block' }} /> Treinou
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--background-secondary)', border: '1px solid var(--border-color)', display: 'inline-block', opacity: 0.4 }} /> Não treinou
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${COLORS.primary}`, display: 'inline-block' }} /> Hoje
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bar chart */}
                                    {freqChartData && (
                                        <div style={{ ...chartContainer, height: 200 }}>
                                            <Bar
                                                data={freqChartData}
                                                options={{
                                                    ...baseLineOpts(freqMode === 'weekly' ? 'Dias Treinados' : 'Treinou'),
                                                    plugins: {
                                                        ...baseLineOpts('').plugins,
                                                        legend: { display: false }
                                                    },
                                                    scales: {
                                                        ...baseLineOpts('').scales,
                                                        y: {
                                                            ...baseLineOpts('').scales.y,
                                                            max: freqMode === 'weekly' ? 7 : 1,
                                                            ticks: {
                                                                ...baseLineOpts('').scales.y.ticks,
                                                                stepSize: 1,
                                                                callback: (v: any) => freqMode === 'monthly' ? (v === 1 ? 'Sim' : 'Não') : v
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : emptyBlock('Nenhum dado de frequência encontrado. Complete treinos para ver sua consistência!')}
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div style={{ textAlign: 'center', padding: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.6 }}>
                    Os dados são baseados nos treinos concluídos via Iniciar Treino
                </div>
            </div>
        </AlunoLayout>
    );
}
