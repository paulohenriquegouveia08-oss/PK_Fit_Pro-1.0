-- ============================================
-- WORKOUT DIARY TABLES
-- Diário de Treino do Aluno
-- ============================================

-- 1. Tabela principal: workout_diaries
CREATE TABLE IF NOT EXISTS workout_diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de exercícios: workout_diary_exercises
CREATE TABLE IF NOT EXISTS workout_diary_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    workout_diary_id UUID NOT NULL REFERENCES workout_diaries(id) ON DELETE CASCADE,
    exercise_name VARCHAR(200) NOT NULL,
    sets INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    weight DECIMAL(6,2) DEFAULT 0,
    unit VARCHAR(10) DEFAULT 'kg',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_workout_diaries_student ON workout_diaries(student_id);
CREATE INDEX IF NOT EXISTS idx_workout_diaries_academy ON workout_diaries(academy_id);
CREATE INDEX IF NOT EXISTS idx_workout_diaries_created ON workout_diaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_exercises_diary ON workout_diary_exercises(workout_diary_id);
CREATE INDEX IF NOT EXISTS idx_diary_exercises_academy ON workout_diary_exercises(academy_id);

-- 4. RLS
ALTER TABLE workout_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_diary_exercises ENABLE ROW LEVEL SECURITY;

-- Policies para workout_diaries
CREATE POLICY "workout_diaries_select" ON workout_diaries
    FOR SELECT USING (true);

CREATE POLICY "workout_diaries_insert" ON workout_diaries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "workout_diaries_update" ON workout_diaries
    FOR UPDATE USING (true);

-- Policies para workout_diary_exercises
CREATE POLICY "diary_exercises_select" ON workout_diary_exercises
    FOR SELECT USING (true);

CREATE POLICY "diary_exercises_insert" ON workout_diary_exercises
    FOR INSERT WITH CHECK (true);
