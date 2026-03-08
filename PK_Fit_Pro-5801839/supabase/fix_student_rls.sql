-- ================================================
-- FIX v2: Permitir que alunos vejam professores
-- Execute este script no SQL Editor do Supabase
-- NÃO exclui nenhum dado, apenas ajusta permissões
-- ================================================

-- ================================================
-- PASSO 1: Desabilitar RLS em tabelas de relacionamento
-- Essas tabelas só guardam IDs, não contêm dados sensíveis
-- A segurança real está na tabela users
-- ================================================

ALTER TABLE academy_users DISABLE ROW LEVEL SECURITY;

ALTER TABLE professor_students DISABLE ROW LEVEL SECURITY;

-- ================================================
-- PASSO 2: Função auxiliar para buscar academy_id do usuário
-- Usa SECURITY DEFINER para bypass de RLS
-- ================================================

CREATE OR REPLACE FUNCTION get_user_academy_id()
RETURNS uuid AS $$
  SELECT academy_id FROM academy_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ================================================
-- PASSO 3: Política na tabela USERS para ALUNO
-- Permite que alunos vejam outros membros da mesma academia
-- ================================================

-- Remover política antiga caso exista
DROP POLICY IF EXISTS "Students can read users in their academy" ON users;

-- Criar nova política usando a função auxiliar (evita referência circular)
CREATE POLICY "Students can read users in their academy" ON users FOR
SELECT USING (
        get_auth_role () = 'ALUNO'
        AND (
            auth.uid () = id
            OR id IN (
                SELECT user_id
                FROM academy_users
                WHERE
                    academy_id = get_user_academy_id ()
            )
        )
    );

-- ================================================
-- PASSO 4: Feedbacks - garantir acesso para alunos
-- ================================================

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Service role full access feedbacks" ON feedbacks;

DROP POLICY IF EXISTS "Students can read own feedbacks" ON feedbacks;

DROP POLICY IF EXISTS "Students can insert feedbacks" ON feedbacks;

DROP POLICY IF EXISTS "Professors can read their feedbacks" ON feedbacks;

DROP POLICY IF EXISTS "Admins can manage feedbacks" ON feedbacks;

DROP POLICY IF EXISTS "Allow all feedbacks operations" ON feedbacks;

-- Permitir leitura e escrita para todos os autenticados
-- (a lógica de quem pode avaliar quem é feita no app)
CREATE POLICY "Authenticated users can use feedbacks" ON feedbacks FOR ALL USING (auth.uid () IS NOT NULL)
WITH
    CHECK (auth.uid () IS NOT NULL);