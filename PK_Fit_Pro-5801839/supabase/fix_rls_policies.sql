-- ================================================
-- FIX DEFINITIVO: Desabilitar RLS nas tabelas de catraca
-- As tabelas já são protegidas pela autenticação do app
-- Cole e rode no SQL Editor do Supabase
-- ================================================

-- 1. Dropar todas as policies existentes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('turnstile_configs', 'access_logs', 'access_commands', 'pairing_codes')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END;
$$;

-- 2. Desabilitar RLS (as tabelas serão protegidas pela autenticação do app)
ALTER TABLE turnstile_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE access_commands DISABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_codes DISABLE ROW LEVEL SECURITY;
