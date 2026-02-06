# CHECKLIST DE CORREÇÃO FINAL

Refaturei o código para usar o **Email da Academia** também como login do usuário responsável. O campo "Email do Responsável" foi removido.

Para garantir que o banco de dados aceite essa criação corretamente, execute o script abaixo.

## 1. Atualizar Função de Criação (SQL)

Execute no SQL Editor do Supabase:

```sql
-- Remove a função antiga
DROP FUNCTION IF EXISTS create_academy_with_user(JSONB, JSONB);

-- Recria a função otimizada
CREATE OR REPLACE FUNCTION create_academy_with_user(
  academy_data JSONB,
  user_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_academy_id UUID;
  new_user_id UUID;
  result JSONB;
BEGIN
  -- 1. Cria Academia
  INSERT INTO academies (
    name, email, phone, address, plan_name, plan_value, status, payment_status, created_at, updated_at
  ) VALUES (
    academy_data->>'name',
    (academy_data->>'email')::VARCHAR,
    (academy_data->>'phone')::VARCHAR,
    (academy_data->>'address')::TEXT,
    (academy_data->>'plan_name')::VARCHAR,
    (academy_data->>'plan_value')::DECIMAL,
    'ACTIVE', 'PENDING', NOW(), NOW()
  )
  RETURNING id INTO new_academy_id;

  -- 2. Cria Usuário (Admin) usando o MESMO email
  INSERT INTO users (
    name, email, role, is_active, created_at, updated_at
  ) VALUES (
    user_data->>'name',
    LOWER(user_data->>'email'), -- Email vem do payload do usuário (que agora é igual ao da academia)
    'ADMIN_ACADEMIA',
    true,
    NOW(), NOW()
  )
  RETURNING id INTO new_user_id;

  -- 3. Vincula
  INSERT INTO academy_users (academy_id, user_id)
  VALUES (new_academy_id, new_user_id);

  -- 4. Retorna Sucesso
  result := jsonb_build_object('success', true, 'academy_id', new_academy_id);
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro na transação: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION create_academy_with_user(JSONB, JSONB) TO anon, authenticated, service_role;
```

## 2. Testar

Agora, ao ir em "Nova Academia":
1. O campo "Email do Responsável" sumiu.
2. Preencha o "Email da Academia".
3. O sistema criará tanto a academia quanto o usuário admin usando esse email.
