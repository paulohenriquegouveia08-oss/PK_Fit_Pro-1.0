-- ================================================
-- MIGRATION: Payments & Expenses (Financial)
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- ================================================
-- ENUM: payment_status_type
-- ================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_type') THEN
    CREATE TYPE payment_status_type AS ENUM ('pago', 'pendente', 'cancelado');
  END IF;
END$$;

-- ================================================
-- TABELA: payments (Pagamentos)
-- ================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  status payment_status_type NOT NULL DEFAULT 'pendente',
  payment_date DATE NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_academy ON payments(academy_id);
CREATE INDEX idx_payments_date ON payments(academy_id, payment_date);
CREATE INDEX idx_payments_status ON payments(academy_id, status);
CREATE INDEX idx_payments_student ON payments(student_id);

-- ================================================
-- TABELA: expenses (Despesas)
-- ================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  category VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_expenses_academy ON expenses(academy_id);
CREATE INDEX idx_expenses_date ON expenses(academy_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses(academy_id, category);

-- ================================================
-- RLS (Row Level Security)
-- ================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access payments"
  ON payments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access expenses"
  ON expenses FOR ALL
  USING (true)
  WITH CHECK (true);
