-- ================================================
-- TABELA: users (Adicionar CREF)
-- ================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS cref VARCHAR(50);

-- ================================================
-- TABELA: academies (Adicionar CNPJ e Student Limit)
-- ================================================
ALTER TABLE academies ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);
ALTER TABLE academies ADD COLUMN IF NOT EXISTS student_limit INTEGER DEFAULT 0;
