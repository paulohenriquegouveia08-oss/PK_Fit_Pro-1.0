-- ================================================
-- ATUALIZAÇÃO DE SEGURANÇA (RLS) PARA A TABELA USERS
-- Execute APENAS este script no SQL Editor do Supabase
-- Este script NÃO apaga nenhum usuário, apenas atualiza as regras de quem pode vê-los.
-- ================================================

-- 1. Assegurar que RLS está habilitado na tabela de usuários
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. DERRUBAR TODAS AS POLÍTICAS EXISTENTES NA TABELA USERS
-- Isso garante que nenhuma política antiga e permissiva (como as que vazavam dados) sobreviva.
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
    END LOOP;
END;
$$;

-- 3. Criar a Função Auxiliar para Checar o Role do Usuário Logado de forma segura
CREATE OR REPLACE FUNCTION get_auth_role() RETURNS text AS $$
  SELECT role::text FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ================================================
-- POLÍTICAS DE SELECT (LEITURA)
-- ================================================

-- Regra de Select 1: Usuários podem ler o próprio perfil
CREATE POLICY "Users can read own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Regra Removida: Login Auth Flow (Abre brecha controlada)
-- Não utilizamos mais USING (true) para não expor a tabela toda a leituras anônimas.
-- Em vez disso, usaremos uma função RPC (abaixo).

-- Criar a Função Auxiliar para Checar o Email com Segurança Definer
-- Isso permite consultar o e-mail de um usuário específico de forma anônima e segura
CREATE OR REPLACE FUNCTION check_user_status_rpc(lookup_email text) 
RETURNS json AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT id, password_hash, is_active, role 
    INTO user_record
    FROM public.users
    WHERE email = lower(lookup_email);

    IF NOT FOUND THEN
        RETURN json_build_object('exists', false);
    END IF;

    RETURN json_build_object(
        'exists', true,
        'hasPassword', (user_record.password_hash IS NOT NULL AND user_record.password_hash != ''),
        'is_active', user_record.is_active,
        'role', user_record.role,
        'id', user_record.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Regra de Select 3: Admins Globais podem ler tudo
CREATE POLICY "Global Admins can read all users" 
ON users FOR SELECT 
USING (get_auth_role() = 'ADMIN_GLOBAL');

-- Regra de Select 3: Admins da Academia podem ler os perfis de alunos ligados à mesma academia
CREATE POLICY "Academy Admins can read users in their academy" 
ON users FOR SELECT 
USING (
  get_auth_role() = 'ADMIN_ACADEMIA' AND (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM academy_users au_owner
      JOIN academy_users au_target ON au_owner.academy_id = au_target.academy_id
      WHERE au_owner.user_id = auth.uid() AND au_target.user_id = users.id
    )
  )
);

-- Regra de Select 4: Professores podem ler perfis dos alunos atribuídos a eles
CREATE POLICY "Professors can read their assigned students" 
ON users FOR SELECT 
USING (
  get_auth_role() = 'PROFESSOR' AND (
    auth.uid() = id OR 
    id IN (SELECT student_id FROM professor_students WHERE professor_id = auth.uid()) OR
    id IN (SELECT user_id FROM academy_users WHERE role = 'ADMIN_ACADEMIA' AND academy_id IN (
            SELECT academy_id FROM academy_users WHERE user_id = auth.uid()
          ))
  )
);

-- ================================================
-- POLÍTICAS DE INSERT / UPDATE / DELETE 
-- ================================================

-- Regra de Mutação 1: Admins globais podem fazer tudo
CREATE POLICY "Global Admins can mutate all users" 
ON users FOR ALL 
USING (get_auth_role() = 'ADMIN_GLOBAL')
WITH CHECK (get_auth_role() = 'ADMIN_GLOBAL');

-- Regra de Mutação 2: Admins de academia podem Criar e Atualizar usuários 
CREATE POLICY "Academy Admins can mutate users within logic" 
ON users FOR ALL 
USING (
    get_auth_role() = 'ADMIN_ACADEMIA' AND role IN ('ALUNO', 'PROFESSOR', 'ADMIN_ACADEMIA')
)
WITH CHECK (
    get_auth_role() = 'ADMIN_ACADEMIA' AND role IN ('ALUNO', 'PROFESSOR')
);

-- Regra de Mutação 3: Usuários comuns podem apenas editar o próprio nome/senha/telefone
CREATE POLICY "Users can update own basic profile" 
ON users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid() LIMIT 1)
);

-- Regra 4: Permitir registro inicial 
CREATE POLICY "Allow public registration to insert their own profile" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);
