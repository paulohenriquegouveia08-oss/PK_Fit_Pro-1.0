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
    getPerformanceComparison,
    calculateMonthlyStats,
    classifyFrequency,
    PERIOD_OPTIONS,
    type LoadEvolutionPoint,
    type RepsEvolutionPoint,
    type FrequencyDay,
    type AnalysisInsight,
    type PerformanceComparison
} from '../../../shared/services/evolution.service';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/aluno.css';

const COLORS = {
    primary: 'var(--primary-500)',
    primaryRgb: '59, 130, 246',
    primaryAlpha: 'rgba(59, 130, 246, 0.15)',
    success: 'rgb(34, 197, 94)',
    successAlpha: 'rgba(34, 197, 94, 0.2)',
    danger: 'rgb(239, 68, 68)',
    dangerAlpha: 'rgba(239, 68, 68, 0.2)',
    neutral: '#94a3b8',
    bgSecondary: 'var(--bg-tertiary)',
    border: 'var(--border-color)',
};

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const fmtDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
};

function formatDateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Evolucao() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [calendarKey, setCalendarKey] = useState(`${today.getFullYear()}-${today.getMonth()}`);

    const [globalPeriod, setGlobalPeriod] = useState(30);

    const [loadData, setLoadData] = useState<LoadEvolutionPoint[]>([]);
    const [freqData, setFreqData] = useState<FrequencyDay[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);

    const [repsDataMap, setRepsDataMap] = useState<Record<string, RepsEvolutionPoint[]>>({});
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
    const [selectedChartExercise, setSelectedChartExercise] = useState<string | null>(null);
    const [chartTab, setChartTab] = useState<'volume' | 'carga' | 'reps'>('volume');

    const [insights, setInsights] = useState<AnalysisInsight[]>([]);
    const [performance, setPerformance] = useState<PerformanceComparison>({
        volumeEvolution: 0, loadEvolution: 0, freqEvolution: 0
    });

    useEffect(() => {
        const sId = getCurrentStudentId();
        if (!sId) { setIsLoading(false); return; }
        setStudentId(sId);
        getStudentExercises(sId).then(setExercises);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!studentId) return;

        Promise.all([
            getLoadEvolution(studentId, globalPeriod),
            getTrainingFrequency(studentId, 365)
        ]).then(([lData, fData]) => {
            setLoadData(lData);
            setFreqData(fData);
            setInsights(generateInsights(lData, fData, globalPeriod));
            setPerformance(getPerformanceComparison(lData, fData));
        });
    }, [studentId, globalPeriod]);

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

    useEffect(() => {
        if (exercises.length > 0 && !selectedChartExercise) {
            setSelectedChartExercise(exercises[0]);
        }
    }, [exercises, selectedChartExercise]);

    // ─── Calendar Logic ───

    const trainedDates = useMemo(() => {
        const set = new Set<string>();
        freqData.forEach(d => { if (d.trained) set.add(d.date); });
        return set;
    }, [freqData]);

    const goToPrevMonth = () => {
        const m = currentMonth - 1;
        if (m < 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
        else { setCurrentMonth(m); }
        setCalendarKey(`${currentMonth === 0 ? currentYear - 1 : currentYear}-${m < 0 ? 11 : m}`);
    };

    const goToNextMonth = () => {
        const m = currentMonth + 1;
        if (m > 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
        else { setCurrentMonth(m); }
        setCalendarKey(`${currentMonth === 11 ? currentYear + 1 : currentYear}-${m > 11 ? 0 : m}`);
    };

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentMonthFreq = useMemo(() => {
        return freqData.filter(d => {
            const [y, m] = d.date.split('-');
            return parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth;
        });
    }, [freqData, currentYear, currentMonth]);

    const prevMonthFreq = useMemo(() => {
        return freqData.filter(d => {
            const [y, m] = d.date.split('-');
            return parseInt(y) === prevYear && parseInt(m) - 1 === prevMonth;
        });
    }, [freqData, prevYear, prevMonth]);

    const monthlyStats = useMemo(() => calculateMonthlyStats(currentMonthFreq), [currentMonthFreq]);
    const prevStats = useMemo(() => calculateMonthlyStats(prevMonthFreq), [prevMonthFreq]);

    const trainingDiff = useMemo(() => {
        if (!prevStats || prevStats.trainingDays === 0) return null;
        return Math.round(((monthlyStats.trainingDays - prevStats.trainingDays) / prevStats.trainingDays) * 100);
    }, [monthlyStats, prevStats]);

    const frequencyClass = useMemo(() => classifyFrequency(monthlyStats.frequencyPercentage), [monthlyStats]);

    const calendarGrid = useMemo(() => {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
        const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

        const grid: Array<{
            day: number; date: string; isCurrentMonth: boolean;
            isToday: boolean; trained: boolean
        }> = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const m = currentMonth - 1;
            const y = m < 0 ? currentYear - 1 : currentYear;
            const mo = m < 0 ? 11 : m;
            const date = formatDateStr(y, mo, daysInPrevMonth - i);
            grid.push({ day: daysInPrevMonth - i, date, isCurrentMonth: false, isToday: false, trained: trainedDates.has(date) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = formatDateStr(currentYear, currentMonth, i);
            grid.push({ day: i, date, isCurrentMonth: true, isToday: date === todayStr, trained: trainedDates.has(date) });
        }

        const remaining = 42 - grid.length;
        for (let i = 1; i <= remaining; i++) {
            const m = currentMonth + 1;
            const y = m > 11 ? currentYear + 1 : currentYear;
            const mo = m > 11 ? 0 : m;
            const date = formatDateStr(y, mo, i);
            grid.push({ day: i, date, isCurrentMonth: false, isToday: false, trained: trainedDates.has(date) });
        }

        return grid;
    }, [currentYear, currentMonth, trainedDates, today]);

    // ─── Monthly Insights ───

    const monthlyInsights = useMemo(() => {
        const result: Array<{
            icon: string; title: string; description: string; type: 'positive' | 'attention' | 'motivation'
        }> = [];

        if (trainingDiff !== null && Math.abs(trainingDiff) > 0) {
            if (trainingDiff > 5) {
                result.push({
                    icon: '📈',
                    title: 'Evolução positiva',
                    description: `Sua frequência aumentou ${trainingDiff}% em relação ao mês anterior.`,
                    type: 'positive'
                });
            } else if (trainingDiff < -5) {
                result.push({
                    icon: '📉',
                    title: 'Frequência abaixo da meta',
                    description: `Sua frequência caiu ${Math.abs(trainingDiff)}% em relação ao mês anterior.`,
                    type: 'attention'
                });
            }
        }

        if (monthlyStats.frequencyPercentage >= 60 && result.length < 2) {
            result.push({
                icon: '🔥',
                title: 'Continue assim',
                description: 'Você está mantendo uma ótima consistência nos treinos.',
                type: 'motivation'
            });
        }

        if (monthlyStats.trainingDays === 0) {
            result.push({
                icon: '💪',
                title: 'Vamos começar?',
                description: 'Nenhum treino registrado neste mês. Que tal iniciar agora?',
                type: 'attention'
            });
        }

        if (result.length === 0) {
            result.push({
                icon: '📊',
                title: 'Consistência em construção',
                description: 'Continue treinando para construir uma boa sequência.',
                type: 'motivation'
            });
        }

        return result;
    }, [trainingDiff, monthlyStats]);

    // ─── Chart Data ───

    const mergedChartData = useMemo(() => {
        if (!selectedChartExercise) return { data: [], avgVolume: 0, avgLoad: 0, avgReps: 0, evolVolume: 0, evolLoad: 0, evolReps: 0 };

        const exerciseLoadData = loadData.filter(d => d.exercise_name === selectedChartExercise);
        const exerciseRepsData = repsDataMap[selectedChartExercise] || [];

        const byDate = new Map<string, { volume: number; load: number; reps: number }>();
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

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="chart-tooltip">
                    <p className="chart-tooltip-date">{label}</p>
                    <div className="chart-tooltip-stats">
                        <span className="chart-tooltip-row">
                            <span>💪 Carga:</span> <strong>{data.load}kg</strong>
                        </span>
                        <span className="chart-tooltip-row">
                            <span>🔁 Reps:</span> <strong>{data.reps}</strong>
                        </span>
                        <span className="chart-tooltip-row">
                            <span>⚡ Volume:</span> <strong>{data.volume}kg</strong>
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

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
            <div className="evolution-badge">
                <span className={`evolution-value ${isPos ? 'positive' : 'negative'}`}>
                    {isPos ? '↑' : '↓'} {Math.abs(val)}%
                </span>
                <span className="evolution-label">{label}</span>
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
            <div className="evolucao-page">

                {/* Period Selector */}
                <div className="period-selector">
                    {PERIOD_OPTIONS.map(p => (
                        <button key={p.value} style={pillStyle(globalPeriod === p.value)} onClick={() => setGlobalPeriod(p.value)}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* ─── MONTHLY CALENDAR ─── */}
                <div className="glass-card calendar-card">
                    <div className="calendar-header">
                        <div className="calendar-title-group">
                            <span className="calendar-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            </span>
                            <div>
                                <h3 className="calendar-title">Calendário de Treinos</h3>
                                <p className="calendar-subtitle">Visualize os dias em que você treinou</p>
                            </div>
                        </div>
                        <div className="calendar-nav">
                            <button className="calendar-nav-btn" onClick={goToPrevMonth} aria-label="Mês anterior">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <span className="calendar-month-label">
                                {MONTHS[currentMonth]} {currentYear}
                            </span>
                            <button className="calendar-nav-btn" onClick={goToNextMonth} aria-label="Próximo mês">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div key={calendarKey} className="calendar-grid-wrapper">
                        <div className="calendar-weekdays">
                            {WEEKDAYS.map(day => (
                                <span key={day} className="calendar-weekday">{day}</span>
                            ))}
                        </div>
                        <div className="calendar-grid">
                            {calendarGrid.map((cell, i) => (
                                <div
                                    key={i}
                                    className={`calendar-day ${cell.isCurrentMonth ? '' : 'other-month'} ${cell.isToday ? 'today' : ''} ${cell.trained ? 'trained' : ''}`}
                                >
                                    {cell.trained ? (
                                        <span className="day-circle">{cell.day}</span>
                                    ) : (
                                        <span className="day-number">{cell.day}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="calendar-legend">
                        <span className="legend-item">
                            <span className="legend-dot trained" /> Azul → Dia com treino
                        </span>
                        <span className="legend-item">
                            <span className="legend-dot" /> Cinza → Sem treino
                        </span>
                    </div>
                </div>

                {/* ─── SUMMARY CARDS ─── */}
                <div className="summary-cards">
                    <div className="glass-card summary-card">
                        <div className="summary-card-header">
                            <span className="summary-card-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </span>
                            <span className="summary-card-label">Treinos no mês</span>
                        </div>
                        <div className="summary-card-value">{monthlyStats.trainingDays} treinos</div>
                        {trainingDiff !== null && (
                            <div className={`summary-card-diff ${trainingDiff >= 0 ? 'positive' : 'negative'}`}>
                                {trainingDiff >= 0 ? '↑' : '↓'} {Math.abs(trainingDiff)}% em relação ao mês anterior
                            </div>
                        )}
                    </div>

                    <div className="glass-card summary-card">
                        <div className="summary-card-header">
                            <span className="summary-card-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                            </span>
                            <span className="summary-card-label">Melhor sequência</span>
                        </div>
                        <div className="summary-card-value">{monthlyStats.bestStreak} dias consecutivos</div>
                    </div>

                    <div className="glass-card summary-card">
                        <div className="summary-card-header">
                            <span className="summary-card-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </span>
                            <span className="summary-card-label">Frequência mensal</span>
                        </div>
                        <div className="summary-card-value">{monthlyStats.frequencyPercentage}%</div>
                        <div className={`frequency-badge ${frequencyClass.toLowerCase().replace(/\s+/g, '-')}`}>
                            {frequencyClass}
                        </div>
                    </div>
                </div>

                {/* ─── INSIGHTS ─── */}
                {monthlyInsights.length > 0 && (
                    <div className="insights-list">
                        {monthlyInsights.map((insight, i) => (
                            <div key={i} className={`insight-card ${insight.type}`}>
                                <div className="insight-icon-wrapper">
                                    <span className="insight-icon">{insight.icon}</span>
                                </div>
                                <div className="insight-content">
                                    <strong className="insight-title">{insight.title}</strong>
                                    <p className="insight-description">{insight.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── PERIOD SUMMARY ─── */}
                <div className="glass-card period-summary-card">
                    <h3 className="section-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        Resumo do Período
                    </h3>
                    <div className="period-summary-grid">
                        {renderEvolutionText(performance.volumeEvolution, 'Volume')}
                        {renderEvolutionText(performance.loadEvolution, 'Carga Máx')}
                        {renderEvolutionText(performance.freqEvolution, 'Frequência')}
                    </div>
                </div>

                {/* ─── EXERCISE CHARTS ─── */}
                <div className="glass-card chart-card">
                    <div className="chart-header">
                        <h3 className="section-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            Evolução por Exercício
                        </h3>
                    </div>

                    <div className="exercise-selector">
                        <select
                            value={selectedChartExercise || ''}
                            onChange={(e) => setSelectedChartExercise(e.target.value)}
                            className="exercise-select"
                        >
                            {exercises.length === 0 && <option value="">Nenhum exercício...</option>}
                            {exercises.map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                        <span className="select-arrow">▼</span>
                    </div>

                    {mergedChartData.data.length > 0 && (
                        <div className="chart-metrics">
                            <div className={`chart-metric ${mergedChartData.evolVolume >= 0 ? 'positive' : 'negative'}`}>
                                <span className="metric-label">🔥 Volume</span>
                                <strong className="metric-value">
                                    {mergedChartData.evolVolume > 0 ? '+' : ''}{mergedChartData.evolVolume}%
                                </strong>
                            </div>
                            <div className={`chart-metric ${mergedChartData.evolLoad >= 0 ? 'positive' : 'negative'}`}>
                                <span className="metric-label">💪 Carga Máx</span>
                                <strong className="metric-value">
                                    {mergedChartData.evolLoad > 0 ? '+' : ''}{mergedChartData.evolLoad}kg
                                </strong>
                            </div>
                            <div className={`chart-metric ${mergedChartData.evolReps >= 0 ? 'positive' : 'negative'}`}>
                                <span className="metric-label">🔁 Reps Max</span>
                                <strong className="metric-value">
                                    {mergedChartData.evolReps > 0 ? '+' : ''}{mergedChartData.evolReps}
                                </strong>
                            </div>
                        </div>
                    )}

                    {mergedChartData.data.length > 0 && (
                        <div className="chart-tabs">
                            <button style={pillStyle(chartTab === 'volume')} onClick={() => setChartTab('volume')}>Volume</button>
                            <button style={pillStyle(chartTab === 'carga')} onClick={() => setChartTab('carga')}>Carga</button>
                            <button style={pillStyle(chartTab === 'reps')} onClick={() => setChartTab('reps')}>Repetições</button>
                        </div>
                    )}

                    {mergedChartData.data.length > 0 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartTab === 'volume' ? (
                                    <AreaChart data={mergedChartData.data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVolGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={`var(--primary-500)`} stopOpacity={0.6} />
                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} opacity={0.4} />
                                        <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.neutral }} minTickGap={15} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: COLORS.neutral }} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                        <ReferenceLine y={mergedChartData.avgVolume} stroke={COLORS.neutral} strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: 'Média', fill: COLORS.neutral, fontSize: 10 }} />
                                        <Area type="monotone" dataKey="volume" stroke={`var(--primary-500)`} strokeWidth={3} fill="url(#colorVolGrad)" dot={(props) => renderCustomDot(props, `var(--primary-500)`)} activeDot={{ r: 0 }} />
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
                        <div className="chart-empty">
                            Sem dados suficientes para este exercício no período.
                        </div>
                    )}
                </div>

                {/* ─── EXERCISE LIST ─── */}
                <h3 className="section-title exercise-list-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 6.5h11M6.5 17.5h11M9.5 12h5" />
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                    Evolução por Exercício
                </h3>

                {exercises.length === 0 ? (
                    <div className="empty-state-card">
                        Nenhum exercício registrado neste período.
                    </div>
                ) : (
                    <div className="exercise-list">
                        {exercises.map(ex => {
                            const isExpanded = expandedExercise === ex;
                            const exRepsData = repsDataMap[ex] || [];
                            const hasData = exRepsData.length > 0;
                            const latest = hasData ? exRepsData[exRepsData.length - 1] : null;
                            const first = hasData ? exRepsData[0] : null;
                            const loadEvol = (latest && first && first.load_at_best > 0)
                                ? Math.round(((latest.load_at_best - first.load_at_best) / first.load_at_best) * 100)
                                : 0;

                            return (
                                <div key={ex} className={`exercise-card ${isExpanded ? 'expanded' : ''}`}>
                                    <div
                                        className="exercise-card-header"
                                        onClick={() => setExpandedExercise(isExpanded ? null : ex)}
                                    >
                                        <div className="exercise-card-info">
                                            <strong className="exercise-card-name">{ex}</strong>
                                            {hasData && latest && (
                                                <span className="exercise-card-stats">
                                                    Max: {latest.load_at_best}kg | Reps: {latest.best_reps}
                                                </span>
                                            )}
                                        </div>
                                        <div className="exercise-card-actions">
                                            {hasData && loadEvol !== 0 && (
                                                <span className={`exercise-card-evol ${loadEvol > 0 ? 'positive' : 'negative'}`}>
                                                    {loadEvol > 0 ? '↑' : '↓'} {Math.abs(loadEvol)}%
                                                </span>
                                            )}
                                            <span className={`exercise-card-arrow ${isExpanded ? 'open' : ''}`}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="exercise-card-body">
                                            {!hasData ? (
                                                <p className="exercise-card-loading">Carregando dados...</p>
                                            ) : (
                                                <div className="exercise-card-grid">
                                                    <div className="exercise-card-stat">
                                                        <span className="stat-label">Melhor Carga</span>
                                                        <strong className="stat-value primary">
                                                            {Math.max(...exRepsData.map(d => d.load_at_best))}kg
                                                        </strong>
                                                    </div>
                                                    <div className="exercise-card-stat">
                                                        <span className="stat-label">Melhor Reps</span>
                                                        <strong className="stat-value primary">
                                                            {Math.max(...exRepsData.map(d => d.best_reps))}
                                                        </strong>
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

            {/* ─── Old Insights ─── */}
            {insights.length > 0 && (
                <div className="old-insights">
                    {insights.map((insight, i) => (
                        <div key={i} className={`old-insight-card ${insight.type}`}>
                            <span className="old-insight-icon">{insight.icon}</span>
                            <p className="old-insight-text">{insight.text}</p>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </AlunoLayout>
    );
}
