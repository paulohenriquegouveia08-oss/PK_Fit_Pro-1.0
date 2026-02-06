-- ================================================
-- WORKOUT REQUESTS TABLE - SUPABASE
-- Execute este código no SQL Editor do Supabase
-- ================================================

-- Remover tabela existente se necessário
DROP TABLE IF EXISTS workout_requests CASCADE;

-- Criar tabela de solicitações de treino
CREATE TABLE workout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workout_requests_student ON workout_requests(student_id);
CREATE INDEX idx_workout_requests_professor ON workout_requests(professor_id);
CREATE INDEX idx_workout_requests_status ON workout_requests(status);

-- RLS
ALTER TABLE workout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all workout_requests operations" ON workout_requests;
CREATE POLICY "Allow all workout_requests operations" ON workout_requests FOR ALL USING (true);

-- ================================================
-- Adicionar campo para notificação de treino atualizado na tabela users
-- ================================================
-- Adiciona coluna para rastrear se o usuário tem treino atualizado não visto
ALTER TABLE users ADD COLUMN IF NOT EXISTS workout_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS workout_update_seen BOOLEAN DEFAULT true;

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- Se executou com sucesso, você verá a tabela:
-- - workout_requests
