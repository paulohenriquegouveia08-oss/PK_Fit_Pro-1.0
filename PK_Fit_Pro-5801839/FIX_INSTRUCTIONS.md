# Instruções de Correção

Para que o sistema funcione corretamente com as correções de exclusão e criação, você precisa executar os scripts SQL abaixo no seu Supabase.

## 1. Correção de Exclusão (Se ainda não rodou)

Este script permite apagar o login do usuário quando ele é excluído do sistema.

**Arquivo:** `supabase/delete_user_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION delete_user_by_email(email_arg TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF email_arg IS NULL THEN RETURN; END IF;
  DELETE FROM auth.users WHERE email = LOWER(email_arg);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_by_email(TEXT) TO anon, authenticated, service_role;
```

## 2. Correção de Criação de Academia [NOVO]

Este script garante que ao criar uma academia, o usuário também seja criado. Se der erro em um, nada é criado (evita academias sem dono).

**Arquivo:** `supabase/create_academy_rpc.sql`

1. Copie o conteúdo do arquivo `supabase/create_academy_rpc.sql` que está no seu projeto.
2. Cole no SQL Editor do Supabase.
3. Execute.

Isso corrigirá o erro de "email não encontrado" ao criar novas academias.
