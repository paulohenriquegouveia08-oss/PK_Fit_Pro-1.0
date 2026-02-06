-- ================================================
-- WORKOUT TABLES - SUPABASE
-- Execute este código no SQL Editor do Supabase
-- ================================================

-- IMPORTANTE: Estes comandos vão RECRIAR as tabelas
-- Se você já tem dados, eles serão PERDIDOS!

-- Remover tabelas existentes (na ordem correta por causa das foreign keys)
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS workout_days CASCADE;
DROP TABLE IF EXISTS workouts CASCADE;

-- ================================================
-- CRIAR TABELAS
-- ================================================

-- Workouts table (main workout record)
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_workouts_student ON workouts(student_id);
CREATE INDEX idx_workouts_professor ON workouts(professor_id);
CREATE INDEX idx_workouts_active ON workouts(is_active);

-- Workout days table (Day A, Day B, etc.)
CREATE TABLE workout_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    day_label VARCHAR(1) NOT NULL, -- 'A', 'B', 'C', etc.
    day_name VARCHAR(100) NOT NULL, -- 'Peito e Tríceps', 'Costas e Bíceps', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workout_days_workout ON workout_days(workout_id);

-- Exercises table
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sets INTEGER NOT NULL DEFAULT 3,
    reps VARCHAR(20) NOT NULL DEFAULT '10-12',
    rest_seconds INTEGER NOT NULL DEFAULT 60,
    load VARCHAR(50),
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_exercises_workout_day ON exercises(workout_day_id);

-- ================================================
-- RLS POLICIES
-- ================================================

-- Enable RLS
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Allow all operations (ajuste conforme sua necessidade de segurança)
DROP POLICY IF EXISTS "Allow all workout operations" ON workouts;
DROP POLICY IF EXISTS "Allow all workout_days operations" ON workout_days;
DROP POLICY IF EXISTS "Allow all exercises operations" ON exercises;

CREATE POLICY "Allow all workout operations" ON workouts FOR ALL USING (true);
CREATE POLICY "Allow all workout_days operations" ON workout_days FOR ALL USING (true);
CREATE POLICY "Allow all exercises operations" ON exercises FOR ALL USING (true);

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- Se executou com sucesso, você verá as tabelas:
-- - workouts
-- - workout_days  
-- - exercises
