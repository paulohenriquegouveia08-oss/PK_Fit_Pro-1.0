-- ================================================
-- MIGRATION: Plans & Student Plans
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- ================================================
-- TABELA: plans (Planos da Academia)
-- ================================================

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration_in_months INTEGER NOT NULL CHECK (duration_in_months >= 1),
  has_time_restriction BOOLEAN DEFAULT FALSE,
  allowed_start_time TIME NULL,
  allowed_end_time TIME NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Se tem restrição de horário, end_time deve ser > start_time
  CONSTRAINT chk_time_restriction CHECK (
    has_time_restriction = FALSE
    OR (
      allowed_start_time IS NOT NULL
      AND allowed_end_time IS NOT NULL
      AND allowed_end_time > allowed_start_time
    )
  )
);

-- Indexes
CREATE INDEX idx_plans_academy ON plans(academy_id);
CREATE INDEX idx_plans_active ON plans(academy_id, is_active);

-- Trigger updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABELA: student_plans (Vínculo Aluno ↔ Plano)
-- ================================================

CREATE TABLE student_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  plan_start_date DATE NOT NULL,
  plan_end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_student_plans_student ON student_plans(student_id);
CREATE INDEX idx_student_plans_plan ON student_plans(plan_id);
CREATE INDEX idx_student_plans_academy ON student_plans(academy_id);
CREATE INDEX idx_student_plans_active ON student_plans(student_id, is_active) WHERE is_active = true;

-- ================================================
-- RLS (Row Level Security)
-- ================================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_plans ENABLE ROW LEVEL SECURITY;

-- Policies para service role (bypass RLS)
-- Em produção, configurar policies baseadas no contexto do usuário
CREATE POLICY "Service role full access plans"
  ON plans FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access student_plans"
  ON student_plans FOR ALL
  USING (true)
  WITH CHECK (true);
