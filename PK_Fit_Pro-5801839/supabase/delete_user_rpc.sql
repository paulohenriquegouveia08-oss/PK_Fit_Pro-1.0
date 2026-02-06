-- ================================================
-- FIX USER DELETION - DELETE FROM AUTH.USERS
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- Função para excluir usuário do auth.users pelo email
-- Necessário SECURITY DEFINER para acessar o schema auth
CREATE OR REPLACE FUNCTION delete_user_by_email(email_arg TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se o email foi fornecido
  IF email_arg IS NULL THEN
    RETURN;
  END IF;

  -- Exclui da tabela auth.users
  DELETE FROM auth.users 
  WHERE email = LOWER(email_arg);
  
  -- A exclusão em public.users deve acontecer via aplicação ou cascade
  -- mas por segurança, podemos tentar limpar também se o cascade falhar
  -- DELETE FROM public.users WHERE email = LOWER(email_arg);
END;
$$;

-- Conceder permissão de execução para o papel anon (usado pelo frontend)
-- e authenticated (caso logado)
GRANT EXECUTE ON FUNCTION delete_user_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION delete_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_by_email(TEXT) TO service_role;
