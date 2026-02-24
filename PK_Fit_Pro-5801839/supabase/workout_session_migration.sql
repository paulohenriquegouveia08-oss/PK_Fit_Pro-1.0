-- ============================================
-- WORKOUT SESSION TABLES
-- Inicializador de Treino — Sessões e Execução
-- ============================================

-- 1. Tabela de sessões de treino
CREATE TABLE IF NOT EXISTS workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'em_andamento'
        CHECK (status IN ('em_andamento', 'concluido', 'pausado')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    total_duration_seconds INTEGER DEFAULT 0,
    total_volume DECIMAL(10,2) DEFAULT 0,
    total_sets INTEGER DEFAULT 0,
    total_exercises INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de séries executadas
CREATE TABLE IF NOT EXISTS workout_set_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    set_number INTEGER NOT NULL,
    reps_target VARCHAR(20),
    reps_done INTEGER NOT NULL DEFAULT 0,
    load_target VARCHAR(50),
    load_done DECIMAL(6,2) DEFAULT 0,
    rest_seconds_target INTEGER DEFAULT 60,
    rest_seconds_used INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_sessions_student ON workout_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON workout_sessions(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON workout_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_set_logs_session ON workout_set_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON workout_set_logs(exercise_id);

-- 4. RLS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON workout_sessions FOR SELECT USING (true);
CREATE POLICY "sessions_insert" ON workout_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_update" ON workout_sessions FOR UPDATE USING (true);
CREATE POLICY "sessions_delete" ON workout_sessions FOR DELETE USING (true);

CREATE POLICY "set_logs_select" ON workout_set_logs FOR SELECT USING (true);
CREATE POLICY "set_logs_insert" ON workout_set_logs FOR INSERT WITH CHECK (true);
