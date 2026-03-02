-- ========================================================================================
-- MIGRAÃ‡ÃƒO PARA AUTH NATIVO (SUPABASE AUTH)
-- ========================================================================================

-- 1. Trigger de SincronizaÃ§Ã£o: Cria um registro em public.users sempre que
-- um usuÃ¡rio realizar o sign up real no backend (auth.users).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    (COALESCE(new.raw_user_meta_data->>'role', 'ALUNO'))::public.user_role,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ========================================================================================
-- FUNÃ‡ÃƒO RPC PARA IMPORTAÃ‡ÃƒO DO MODO LEGADO (MIGRADOR)
-- Roda apenas uma vez para transferir as contas antigas locais para o Cloud Auth oficial
-- ========================================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION sync_legacy_users_to_auth()
RETURNS void AS $$
DECLARE
    legacy_user RECORD;
    temp_password text;
BEGIN
    FOR legacy_user IN SELECT * FROM public.users
    LOOP
        -- Checar se o usuario jÃ¡ foi migrado antes
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = legacy_user.id) THEN
            
            -- Por seguranÃ§a, o sistema nativo nÃ£o aceita senhas hasheadas manualmente
            -- Portanto, definiremos uma senha padrao temporaria: 'Mud@r123'
            -- O usuÃ¡rio ou admin poderÃ¡ alterar depois (recovery flow)
            temp_password := 'Mud@r123';

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
                legacy_user.id,
                'authenticated',
                'authenticated',
                legacy_user.email,
                crypt(temp_password, gen_salt('bf')),
                now(),
                now(),
                now(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('name', legacy_user.name, 'role', legacy_user.role),
                legacy_user.created_at,
                legacy_user.updated_at,
                '',
                '',
                '',
                ''
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Para rodar:
-- SELECT sync_legacy_users_to_auth();


-- ========================================================================================
-- FUNÃ‡ÃƒO RPC PARA CRIAR USUÃRIOS NO AUTH.USERS DE FORMA PROGRAMÃTICA
-- Isso deve ser usado porque o supabase.auth.signUp desloga o usuÃ¡rio atual
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
    -- Checa se quem estÃ¡ chamando Ã© um admin da academia ou global
    IF (SELECT role FROM public.users WHERE id = auth.uid()) NOT IN ('ADMIN_ACADEMIA', 'ADMIN_GLOBAL') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem criar contas.';
    END IF;

    -- Tenta encontrar o usuÃ¡rio pelo email para nÃ£o duplicar e causar erro estranho
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(raw_email)) THEN
        RAISE EXCEPTION 'EndereÃ§o de email jÃ¡ cadastrado.';
    END IF;

    -- Apenas inserimos na tabela de auth
    -- A nossa trigger 'on_auth_user_created' farÃ¡ a cÃ³pia para a tabela public.users
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


SELECT sync_legacy_users_to_auth();