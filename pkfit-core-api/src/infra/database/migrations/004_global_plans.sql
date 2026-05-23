-- ================================================
-- TABELA: global_plans
-- ================================================
CREATE TABLE IF NOT EXISTS global_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  student_limit INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir planos padrão iniciais
INSERT INTO global_plans (name, price, student_limit) VALUES 
('Básico', 99.90, 100),
('Pro', 199.90, 500),
('Premium', 299.90, 999999)
ON CONFLICT DO NOTHING;
