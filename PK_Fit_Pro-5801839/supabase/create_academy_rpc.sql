-- ================================================
-- FUNÇÃO PARA CRIAÇÃO ATÔMICA DE ACADEMIA E USUÁRIO
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- Define a função 'create_academy_with_user' que aceita parâmetros JSON
-- para os dados da academia e do usuário responsável.
-- Retorna um tipo JSON com os dados criados ou erro.
CREATE OR REPLACE FUNCTION create_academy_with_user(
  academy_data JSONB, -- Dados da academia (nome, email, plano, etc)
  user_data JSONB     -- Dados do usuário admin (nome, email)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com privilégios de sistema (necessário para operações complexas)
AS $$
DECLARE
  new_academy_id UUID; -- Variável para armazenar o ID da academia criada
  new_user_id UUID;    -- Variável para armazenar o ID do usuário criado
  result JSONB;        -- Variável para o resultado final
BEGIN
  -- 1. CRIAÇÃO DA ACADEMIA
  -- Insere os dados na tabela 'academies' e retorna o ID gerado
  INSERT INTO academies (
    name,
    email,
    phone,
    address,
    plan_name,
    plan_value,
    status,
    payment_status,
    created_at,
    updated_at
  ) VALUES (
    academy_data->>'name',
    (academy_data->>'email')::VARCHAR, -- Cast para garantir o tipo correto
    (academy_data->>'phone')::VARCHAR,
    (academy_data->>'address')::TEXT,
    (academy_data->>'plan_name')::VARCHAR,
    (academy_data->>'plan_value')::DECIMAL,
    'ACTIVE',    -- Status inicial padrão
    'PENDING',   -- Status de pagamento inicial
    NOW(),
    NOW()
  )
  RETURNING id INTO new_academy_id;

  -- 2. CRIAÇÃO DO USUÁRIO ADMIN
  -- Insere o usuário na tabela 'users'. 
  -- Se o email já existir, isso causará um erro que abortará TODA a transação (rollback automático).
  INSERT INTO users (
    name,
    email,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    user_data->>'name',
    LOWER(user_data->>'email'), -- Garante email em minúsculas
    'ADMIN_ACADEMIA',           -- Papel fixo para quem cria academia
    true,                       -- Usuário ativo
    NOW(),
    NOW()
  )
  RETURNING id INTO new_user_id;

  -- 3. VÍNCULO ACADEMIA-USUÁRIO
  -- Cria o registro na tabela de junção
  INSERT INTO academy_users (
    academy_id,
    user_id,
    created_at
  ) VALUES (
    new_academy_id,
    new_user_id,
    NOW()
  );

  -- 4. RETORNO DE SUCESSO
  -- Monta um objeto JSON com os IDs criados para confirmar o sucesso
  result := jsonb_build_object(
    'success', true,
    'academy_id', new_academy_id,
    'user_id', new_user_id
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- EM CASO DE ERRO (ex: email duplicado)
  -- A transação é abortada automaticamente pelo Postgres.
  -- Aqui capturamos o erro para retornar uma mensagem amigável se possível.
  
  -- Retorna um objeto JSON indicando falha e a mensagem de erro original
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- CONCESSÃO DE PERMISSÕES
-- Permite que usuários anônimos (frontend) e logados executem a função
GRANT EXECUTE ON FUNCTION create_academy_with_user(JSONB, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_academy_with_user(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_academy_with_user(JSONB, JSONB) TO service_role;
