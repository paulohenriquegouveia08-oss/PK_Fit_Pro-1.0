import { useState, useEffect, useMemo } from 'react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    ReferenceLine,
    Dot
} from 'recharts';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import {
    getLoadEvolution,
    getRepsEvolution,
    getTrainingFrequency,
    getStudentExercises,
    generateInsights,
    getStreaks,
    getPerformanceComparison,
    PERIOD_OPTIONS,
    type LoadEvolutionPoint,
    type RepsEvolutionPoint,
    type FrequencyDay,
    type AnalysisInsight,
    type StreakInfo,
    type PerformanceComparison
} from '../../../shared/services/evolution.service';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/aluno.css';

// Chart.js removed in favor of Recharts

// ─── Chart Colors ───
const COLORS = {
    primary: 'rgb(99, 102, 241)',
    primaryAlpha: 'rgba(99, 102, 241, 0.2)',
    success: 'rgb(34, 197, 94)',
    successAlpha: 'rgba(34, 197, 94, 0.2)',
    danger: 'rgb(239, 68, 68)',
    dangerAlpha: 'rgba(239, 68, 68, 0.2)',
    neutral: '#94a3b8',
    bgSecondary: 'var(--background-secondary)',
    border: 'var(--border-color)',
};

// ─── Helpers ───
const fmtDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
};

export default function Evolucao() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Global filters
    const [globalPeriod, setGlobalPeriod] = useState(30);

    // --- State Data ---
    const [loadData, setLoadData] = useState<LoadEvolutionPoint[]>([]);
    const [freqData, setFreqData] = useState<FrequencyDay[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);

    // Exercise specific evolution
    const [repsDataMap, setRepsDataMap] = useState<Record<string, RepsEvolutionPoint[]>>({});
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
    const [selectedChartExercise, setSelectedChartExercise] = useState<string | null>(null);
    const [chartTab, setChartTab] = useState<'volume' | 'carga' | 'reps'>('volume');

    // Set first exercise as default when exercises load
    useEffect(() => {
        if (exercises.length > 0 && !selectedChartExercise) {
            setSelectedChartExercise(exercises[0]);
        }
    }, [exercises, selectedChartExercise]);

    // Derived stats
    const [insights, setInsights] = useState<AnalysisInsight[]>([]);
    const [streak, setStreak] = useState<StreakInfo>({ currentStreak: 0, bestStreak: 0 });
    const [performance, setPerformance] = useState<PerformanceComparison>({ volumeEvolution: 0, loadEvolution: 0, freqEvolution: 0 });

    // Init
    useEffect(() => {
        const sId = getCurrentStudentId();
        if (!sId) { setIsLoading(false); return; }
        setStudentId(sId);
        getStudentExercises(sId).then(setExercises);
        setIsLoading(false);
    }, []);

    // Fetch Global Data
    useEffect(() => {
        if (!studentId) return;

        Promise.all([
            getLoadEvolution(studentId, globalPeriod),
            getTrainingFrequency(studentId, globalPeriod)
        ]).then(([lData, fData]) => {
            setLoadData(lData);
            setFreqData(fData);

            setInsights(generateInsights(lData, fData, globalPeriod));
            setStreak(getStreaks(fData));
            setPerformance(getPerformanceComparison(lData, fData));
        });
    }, [studentId, globalPeriod]);

    // Fetch exercise data (for both chart and expanded bottom list)
    useEffect(() => {
        if (!studentId) return;
        const exercisesToFetch = [expandedExercise, selectedChartExercise].filter(Boolean) as string[];
        
        exercisesToFetch.forEach(ex => {
            if (!repsDataMap[ex]) {
                getRepsEvolution(studentId, ex, globalPeriod).then(data => {
                    setRepsDataMap(prev => ({ ...prev, [ex]: data }));
                });
            }
        });
    }, [studentId, expandedExercise, selectedChartExercise, globalPeriod, repsDataMap]);

    // ────── CHART DATA ──────

    const mergedChartData = useMemo(() => {
        if (!selectedChartExercise) return { data: [], avgVolume: 0, avgLoad: 0, avgReps: 0, evolVolume: 0, evolLoad: 0, evolReps: 0 };
        
        const exerciseLoadData = loadData.filter(d => d.exercise_name === selectedChartExercise);
        const exerciseRepsData = repsDataMap[selectedChartExercise] || [];

        const byDate = new Map<string, { volume: number, load: number, reps: number }>();
        exerciseLoadData.forEach(d => {
            byDate.set(d.date, { volume: d.total_volume, load: d.max_load, reps: 0 });
        });
        
        exerciseRepsData.forEach(d => {
            if (!byDate.has(d.date)) byDate.set(d.date, { volume: 0, load: 0, reps: 0 });
            const item = byDate.get(d.date)!;
            item.reps = d.best_reps;
            if (d.load_at_best > item.load) item.load = d.load_at_best;
        });

        const sortedDates = Array.from(byDate.keys()).sort();
        let bestVolume = -1;
        let bestVolumeData: any = null;

        const finalData = sortedDates.map(d => {
            const item = byDate.get(d)!;
            const obj = {
                rawDate: d,
                dateLabel: fmtDate(d),
                volume: item.volume,
                load: item.load,
                reps: item.reps,
                isBest: false,
                isLast: false
            };
            if (item.volume > bestVolume) {
                bestVolume = item.volume;
                bestVolumeData = obj;
            }
            return obj;
        });

        if (bestVolumeData) bestVolumeData.isBest = true;
        if (finalData.length > 0) finalData[finalData.length - 1].isLast = true;

        const len = finalData.length || 1;
        const avgVolume = Math.round(finalData.reduce((acc, curr) => acc + curr.volume, 0) / len);
        const avgLoad = Math.round(finalData.reduce((acc, curr) => acc + curr.load, 0) / len);
        const avgReps = Math.round(finalData.reduce((acc, curr) => acc + curr.reps, 0) / len);

        let evolVolume = 0, evolLoad = 0, evolReps = 0;
        if (finalData.length >= 2) {
            const mid = Math.floor(finalData.length / 2);
            const first = finalData.slice(0, mid);
            const second = finalData.slice(mid);
            const v1 = first.reduce((s, x) => s + x.volume, 0) / (first.length || 1);
            const v2 = second.reduce((s, x) => s + x.volume, 0) / (second.length || 1);
            if (v1 > 0) evolVolume = Math.round(((v2 - v1) / v1) * 100);
            
            const l1 = Math.max(...first.map(p => p.load), 0);
            const l2 = Math.max(...second.map(p => p.load), 0);
            evolLoad = l2 - l1;

            const r1 = Math.max(...first.map(p => p.reps), 0);
            const r2 = Math.max(...second.map(p => p.reps), 0);
            evolReps = r2 - r1; 
        }

        return { data: finalData, avgVolume, avgLoad, avgReps, evolVolume, evolLoad, evolReps };
    }, [loadData, repsDataMap, selectedChartExercise]);
    
    // Custom Tooltip component for Recharts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                    minWidth: '160px'
                }}>
                    <p style={{ margin: '0 0 12px 0', color: '#fff', fontWeight: 700, fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>📅 {label}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <span style={{ color: 'var(--neutral-400, #94a3b8)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                            <span>💪 Carga:</span> <strong style={{ color: '#fff' }}>{data.load}kg</strong>
                        </span>
                        <span style={{ color: 'var(--neutral-400, #94a3b8)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                            <span>🔁 Reps:</span> <strong style={{ color: '#fff' }}>{data.reps}</strong>
                        </span>
                        <span style={{ color: 'var(--neutral-400, #94a3b8)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                            <span>⚡ Volume:</span> <strong style={{ color: '#fff' }}>{data.volume}kg</strong>
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Customized dot for glowing the last point or best point
    const renderCustomDot = (props: any, baseColor: string) => {
        const { cx, cy, payload } = props;
        if (payload.isLast || payload.isBest) {
            return (
                <svg key={`dot-${payload.rawDate}`} x={cx - 10} y={cy - 10} width={20} height={20} viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill={baseColor} opacity="0.3" />
                    <circle cx="10" cy="10" r="5" fill={baseColor} />
                    <circle cx="10" cy="10" r="3" fill="#fff" />
                    {payload.isBest && <text x="10" y="-2" fill="gold" fontSize="14" textAnchor="middle">🏆</text>}
                </svg>
            );
        }
        return <Dot cx={cx} cy={cy} r={4} fill={baseColor} strokeWidth={2} stroke="#1e293b" />;
    };

    // ────── STYLES ──────
    const cardStyle = {
        background: 'var(--background-primary, #fff)',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${COLORS.border}`,
        padding: 'var(--spacing-4)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        marginBottom: 'var(--spacing-4)'
    };

    const pillStyle = (active: boolean) => ({
        padding: '6px 14px',
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600 as const,
        background: active ? 'var(--primary-500)' : COLORS.bgSecondary,
        color: active ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s',
        flexShrink: 0
    });

    const renderEvolutionText = (val: number, label: string) => {
        const isPos = val >= 0;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: isPos ? COLORS.success : COLORS.danger }}>
                    {isPos ? '↑' : '↓'} {Math.abs(val)}%
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{label}</span>
            </div>
        );
    };

    if (isLoading) {
        return (
            <AlunoLayout title="Evolução" menuItems={menuItems}>
                <div className="loading-state"><div className="spinner" /><p>Carregando Dados...</p></div>
            </AlunoLayout>
        );
    }

    return (
        <AlunoLayout title="Evolução" menuItems={menuItems}>
            <div style={{ paddingBottom: 'var(--spacing-6)', animation: 'fadeIn 0.4s ease-out' }}>


                {/* Period Selector (Horizontal Scroll) */}
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', overflowX: 'auto', paddingBottom: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)', scrollbarWidth: 'none' }}>
                    {PERIOD_OPTIONS.map(p => (
                        <button key={p.value} style={pillStyle(globalPeriod === p.value)} onClick={() => setGlobalPeriod(p.value)}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* 🔥 RESUMO INTELIGENTE */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: '0 0 var(--spacing-3) 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🔥 Resumo do Período
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--spacing-2)' }}>
                        {renderEvolutionText(performance.volumeEvolution, 'Volume')}
                        {renderEvolutionText(performance.loadEvolution, 'Carga Máx')}
                        {renderEvolutionText(performance.freqEvolution, 'Frequência')}
                    </div>
                </div>

                {/* 📈 GRÁFICOS DO EXERCÍCIO COM TABS */}
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                        <div>
                           <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                               📈 Evolução por Exercício
                           </h3>
                        </div>
                        
                        <div style={{ position: 'relative' }}>
                            <select 
                                value={selectedChartExercise || ''}
                                onChange={(e) => setSelectedChartExercise(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    background: COLORS.bgSecondary,
                                    border: `1px solid ${COLORS.border}`,
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    appearance: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {exercises.length === 0 && <option value="">Nenhum exercício...</option>}
                                {exercises.map(ex => (
                                    <option key={ex} value={ex}>{ex}</option>
                                ))}
                            </select>
                            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 12, color: COLORS.neutral }}>▼</span>
                        </div>
                    </div>

                    {/* RESUMO INTELIGENTE DO EXERCÍCIO */}
                    {mergedChartData.data.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: 'var(--spacing-5)' }}>
                            <div style={{ background: mergedChartData.evolVolume >= 0 ? COLORS.successAlpha : COLORS.dangerAlpha, padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${mergedChartData.evolVolume >= 0 ? COLORS.success : COLORS.danger}20` }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>🔥 Volume</span>
                                <strong style={{ fontSize: '15px', color: mergedChartData.evolVolume >= 0 ? COLORS.success : COLORS.danger }}>
                                    {mergedChartData.evolVolume > 0 ? '+' : ''}{mergedChartData.evolVolume}%
                                </strong>
                            </div>
                            <div style={{ background: mergedChartData.evolLoad >= 0 ? COLORS.successAlpha : COLORS.dangerAlpha, padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${mergedChartData.evolLoad >= 0 ? COLORS.success : COLORS.danger}20` }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>💪 Carga Máx</span>
                                <strong style={{ fontSize: '15px', color: mergedChartData.evolLoad >= 0 ? COLORS.success : COLORS.danger }}>
                                    {mergedChartData.evolLoad > 0 ? '+' : ''}{mergedChartData.evolLoad}kg
                                </strong>
                            </div>
                            <div style={{ background: mergedChartData.evolReps >= 0 ? COLORS.successAlpha : COLORS.dangerAlpha, padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${mergedChartData.evolReps >= 0 ? COLORS.success : COLORS.danger}20` }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>🔁 Reps Max</span>
                                <strong style={{ fontSize: '15px', color: mergedChartData.evolReps >= 0 ? COLORS.success : COLORS.danger }}>
                                    {mergedChartData.evolReps > 0 ? '+' : ''}{mergedChartData.evolReps}
                                </strong>
                            </div>
                        </div>
                    )}

                    {/* TABS DE NAVEGAÇÃO DOS GRÁFICOS */}
                    {mergedChartData.data.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                            <button style={pillStyle(chartTab === 'volume')} onClick={() => setChartTab('volume')}>Volume</button>
                            <button style={pillStyle(chartTab === 'carga')} onClick={() => setChartTab('carga')}>Carga</button>
                            <button style={pillStyle(chartTab === 'reps')} onClick={() => setChartTab('reps')}>Repetições</button>
                        </div>
                    )}

                    {/* CONTAINER DO GRÁFICO SELECIONADO */}
                    {mergedChartData.data.length > 0 ? (
                        <div style={{ height: 260, width: '100%', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {chartTab === 'volume' ? (
                                    <AreaChart data={mergedChartData.data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVolGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.6}/>
                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} opacity={0.4} />
                                        <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.neutral }} minTickGap={15} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: COLORS.neutral }} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <ReferenceLine y={mergedChartData.avgVolume} stroke={COLORS.neutral} strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: 'Média', fill: COLORS.neutral, fontSize: 10 }} />
                                        <Area type="monotone" dataKey="volume" stroke="url(#colorVolGrad)" strokeWidth={3} fill="url(#colorVolGrad)" dot={(props) => renderCustomDot(props, COLORS.primary)} activeDot={{ r: 0 }} />
                                    </AreaChart>
                                ) : chartTab === 'carga' ? (
                                    <LineChart data={mergedChartData.data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} opacity={0.4} />
                                        <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.neutral }} minTickGap={15} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: COLORS.neutral }} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <ReferenceLine y={mergedChartData.avgLoad} stroke={COLORS.neutral} strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: 'Média', fill: COLORS.neutral, fontSize: 10 }} />
                                        <Line type="monotone" dataKey="load" stroke={COLORS.success} strokeWidth={3} dot={(props) => renderCustomDot(props, COLORS.success)} activeDot={{ r: 0 }} />
                                    </LineChart>
                                ) : (
                                    <LineChart data={mergedChartData.data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} opacity={0.4} />
                                        <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.neutral }} minTickGap={15} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: COLORS.neutral }} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <ReferenceLine y={mergedChartData.avgReps} stroke={COLORS.neutral} strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: 'Média', fill: COLORS.neutral, fontSize: 10 }} />
                                        <Line type="monotone" dataKey="reps" stroke="#a855f7" strokeWidth={3} dot={(props) => renderCustomDot(props, '#a855f7')} activeDot={{ r: 0 }} />
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-5)', color: 'var(--text-secondary)' }}>
                            Sem dados suficientes para este exercício no período.
                        </div>
                    )}
                </div>

                {/* 📅 CONSISTÊNCIA DE TREINO (GITHUB CALENDAR) & GAMIFICAÇÃO */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            📅 Consistência
                        </h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 16 }}>🔥</span>
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{streak.currentStreak}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 16 }}>🏆</span>
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: COLORS.neutral }}>{streak.bestStreak}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: 4,
                        marginTop: 'var(--spacing-2)'
                    }}>
                        {/* We show the last 28 days to make 4 perfect weeks (7 columns) */}
                        {freqData.slice(-28).map((day, i) => {
                            const isToday = day.date === new Date().toISOString().split('T')[0];
                            let bgColor = 'rgba(148, 163, 184, 0.25)'; // Light gray for empty squares
                            if (day.trained) {
                                // Simulate intensity colors if we have multiple sessions, otherwise default green
                                bgColor = day.session_count > 1 ? 'rgb(21, 128, 61)' : COLORS.success;
                            }

                            return (
                                <div
                                    key={i}
                                    title={`${fmtDate(day.date)} ${day.trained ? '✅' : '❌'}`}
                                    style={{
                                        aspectRatio: '1/1',
                                        borderRadius: 4,
                                        backgroundColor: bgColor,
                                        border: isToday ? `2px solid var(--primary-500)` : (day.trained ? 'none' : '1px solid rgba(148, 163, 184, 0.1)'),
                                        opacity: day.trained ? 1 : 1
                                    }}
                                />
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '10px', textAlign: 'center', marginTop: 'var(--spacing-3)', color: 'var(--text-secondary)' }}>Últimos 28 dias</p>
                </div>

                {/* 🤖 INSIGHTS AUTOMÁTICOS */}
                {insights.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                        {insights.map((insight, i) => (
                            <div key={i} style={{
                                background: insight.type === 'positive' ? COLORS.successAlpha : (insight.type === 'negative' ? COLORS.dangerAlpha : COLORS.bgSecondary),
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--spacing-3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-3)',
                                border: `1px solid ${insight.type === 'positive' ? COLORS.success : (insight.type === 'negative' ? COLORS.danger : COLORS.border)}`
                            }}>
                                <span style={{ fontSize: 24 }}>{insight.icon}</span>
                                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                                    {insight.text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* 🏋️ EVOLUÇÃO POR EXERCÍCIO (EXPANDABLE CARDS) */}
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, margin: 'var(--spacing-5) 0 var(--spacing-3) 0' }}>
                    🏋️ Evolução por Exercício
                </h3>

                {exercises.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-5)', color: 'var(--text-secondary)', background: COLORS.bgSecondary, borderRadius: 'var(--radius-lg)' }}>
                        Nenhum exercício registrado neste período.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                        {exercises.map(ex => {
                            const isExpanded = expandedExercise === ex;
                            const exRepsData = repsDataMap[ex] || [];
                            const hasData = exRepsData.length > 0;

                            // Get latest stats
                            const latest = hasData ? exRepsData[exRepsData.length - 1] : null;
                            const first = hasData ? exRepsData[0] : null;
                            const loadEvol = (latest && first && first.load_at_best > 0) ? Math.round(((latest.load_at_best - first.load_at_best) / first.load_at_best) * 100) : 0;

                            return (
                                <div key={ex} style={{ ...cardStyle, marginBottom: 0, padding: 0, overflow: 'hidden' }}>
                                    {/* Header (Click to expand) */}
                                    <div
                                        onClick={() => setExpandedExercise(isExpanded ? null : ex)}
                                        style={{
                                            padding: 'var(--spacing-3) var(--spacing-4)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            background: isExpanded ? COLORS.bgSecondary : 'transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{ex}</strong>
                                            {hasData && latest && (
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    Max: {latest.load_at_best}kg | Reps: {latest.best_reps}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                            {hasData && loadEvol !== 0 && (
                                                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: loadEvol > 0 ? COLORS.success : COLORS.danger, background: loadEvol > 0 ? COLORS.successAlpha : COLORS.dangerAlpha, padding: '2px 8px', borderRadius: 12 }}>
                                                    {loadEvol > 0 ? '↑' : '↓'} {Math.abs(loadEvol)}%
                                                </span>
                                            )}
                                            <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: 12, color: COLORS.neutral }}>
                                                ▼
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Body Data */}
                                    {isExpanded && (
                                        <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderTop: `1px solid ${COLORS.border}`, animation: 'fadeIn 0.2s ease-out' }}>
                                            {!hasData ? (
                                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>Carregando dados...</p>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                                                    <div style={{ background: COLORS.bgSecondary, padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                                        <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 }}>Melhor Carga</span>
                                                        <strong style={{ fontSize: 'var(--font-size-md)', color: COLORS.primary }}>{Math.max(...exRepsData.map(d => d.load_at_best))}kg</strong>
                                                    </div>
                                                    <div style={{ background: COLORS.bgSecondary, padding: 'var(--spacing-2)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                                        <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 }}>Melhor Reps</span>
                                                        <strong style={{ fontSize: 'var(--font-size-md)', color: COLORS.primary }}>{Math.max(...exRepsData.map(d => d.best_reps))}</strong>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </AlunoLayout>
    );
}
