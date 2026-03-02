-- ========================================================================================
-- FUNÇÃO RPC PARA CRIAR USUÁRIOS NO AUTH.USERS DE FORMA PROGRAMÁTICA
-- Isso deve ser usado porque o supabase.auth.signUp desloga o usuário atual
-- e a interface precisa adicionar alunos e professores.
-- ========================================================================================

CREATE OR REPLACE FUNCTION create_auth_user_admin(
    raw_email text,
    raw_password text,
    raw_name text,
    raw_role text
) RETURNS uuid AS $$
DECLARE
    new_user_id uuid;
BEGIN
    -- Checa se quem está chamando é um admin da academia ou global
    IF (SELECT role FROM public.users WHERE id = auth.uid()) NOT IN ('ADMIN_ACADEMIA', 'ADMIN_GLOBAL') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem criar contas.';
    END IF;

    -- Tenta encontrar o usuário pelo email para não duplicar e causar erro estranho
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(raw_email)) THEN
        RAISE EXCEPTION 'Endereço de email já cadastrado.';
    END IF;

    -- Apenas inserimos na tabela de auth
    -- A nossa trigger 'on_auth_user_created' fará a cópia para a tabela public.users
    new_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        lower(raw_email),
        crypt(raw_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', raw_name, 'role', raw_role),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
