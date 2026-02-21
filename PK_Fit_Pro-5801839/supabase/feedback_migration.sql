-- ================================================
-- MIGRATION: Feedbacks (Avaliações de Professores)
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- ================================================
-- TABELA: feedbacks
-- ================================================

CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  description TEXT NOT NULL CHECK (char_length(description) >= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Um aluno só pode avaliar cada professor uma vez
  CONSTRAINT unique_student_professor_feedback UNIQUE (student_id, professor_id)
);

-- Indexes
CREATE INDEX idx_feedbacks_academy ON feedbacks(academy_id);
CREATE INDEX idx_feedbacks_professor ON feedbacks(academy_id, professor_id);
CREATE INDEX idx_feedbacks_student ON feedbacks(student_id);

-- ================================================
-- RLS (Row Level Security)
-- ================================================

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access feedbacks"
  ON feedbacks FOR ALL
  USING (true)
  WITH CHECK (true);
