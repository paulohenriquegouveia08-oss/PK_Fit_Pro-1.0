-- ================================================
-- MIGRATION: Permitir plano semanal (duration_in_months = 0)
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- Remover constraint antigo que exige duration_in_months >= 1
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_duration_in_months_check;

-- Adicionar novo constraint permitindo 0 (semanal)
ALTER TABLE plans ADD CONSTRAINT plans_duration_in_months_check CHECK (duration_in_months >= 0);
