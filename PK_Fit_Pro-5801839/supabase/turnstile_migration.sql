-- ================================================
-- TURNSTILE INTEGRATION MIGRATION
-- Controle de Acesso com Catracas
-- ================================================

-- ================================================
-- LIMPEZA: Remove objetos existentes antes de recriar
-- Ordem inversa por causa de dependências (FK)
-- ================================================

DROP TABLE IF EXISTS pairing_codes CASCADE;
DROP TABLE IF EXISTS access_commands CASCADE;
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS turnstile_configs CASCADE;

-- Drop functions (IF EXISTS para segurança)
DROP FUNCTION IF EXISTS validate_student_access(UUID, UUID, TIME);
DROP FUNCTION IF EXISTS get_academy_occupancy(UUID);
DROP FUNCTION IF EXISTS generate_pairing_code(UUID, UUID);
DROP FUNCTION IF EXISTS redeem_pairing_code(TEXT);

-- ================================================
-- TABELA: turnstile_configs
-- Configuração da catraca por academia
-- ================================================

CREATE TABLE IF NOT EXISTS turnstile_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Catraca Principal',
    brand VARCHAR(50) NOT NULL,            -- 'CONTROL_ID', 'TOP_DATA', 'HENRY'
    model VARCHAR(100),                    -- modelo específico do equipamento
    ip_address VARCHAR(45),                -- IP na rede local
    port INTEGER DEFAULT 80,
    auth_user VARCHAR(100),                -- credencial de API (se aplicável)
    auth_password VARCHAR(255),            -- senha de API
    is_active BOOLEAN DEFAULT true,
    connection_status VARCHAR(20) DEFAULT 'DISCONNECTED',  -- 'CONNECTED', 'DISCONNECTED', 'ERROR'
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',           -- config extra por marca
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_turnstile_configs_academy ON turnstile_configs(academy_id);
CREATE INDEX idx_turnstile_configs_active ON turnstile_configs(academy_id, is_active) WHERE is_active = true;

-- Trigger de updated_at
CREATE TRIGGER update_turnstile_configs_updated_at
    BEFORE UPDATE ON turnstile_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- TABELA: access_logs
-- Registro de passagens pela catraca
-- ================================================

CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    turnstile_config_id UUID REFERENCES turnstile_configs(id) ON DELETE SET NULL,
    direction VARCHAR(10) DEFAULT 'IN',    -- 'IN' ou 'OUT'
    access_granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100),            -- 'INADIMPLENTE', 'BLOQUEADO', 'FORA_DO_HORARIO', 'PLANO_VENCIDO', 'NAO_ENCONTRADO'
    identification_method VARCHAR(30),     -- 'BIOMETRIC', 'CARD', 'QR_CODE', 'FACIAL', 'MANUAL'
    raw_credential VARCHAR(255),           -- credencial bruta recebida do equipamento
    user_name VARCHAR(255),                -- nome p/ exibição rápida (desnormalizado)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices otimizados para consultas rápidas
CREATE INDEX idx_access_logs_academy_created ON access_logs(academy_id, created_at DESC);
CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at DESC);
CREATE INDEX idx_access_logs_granted ON access_logs(academy_id, access_granted, created_at DESC);

-- ================================================
-- TABELA: access_commands
-- Fila de comandos para o Agent Local
-- ================================================

CREATE TABLE IF NOT EXISTS access_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    turnstile_config_id UUID REFERENCES turnstile_configs(id) ON DELETE CASCADE,
    command_type VARCHAR(30) NOT NULL,     -- 'GRANT_ACCESS', 'DENY_ACCESS', 'SYNC_USERS', 'REBOOT'
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'PENDING',  -- 'PENDING', 'SENT', 'COMPLETED', 'FAILED'
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_access_commands_pending ON access_commands(academy_id, status) WHERE status = 'PENDING';

-- ================================================
-- RPC: validate_student_access
-- Validação RÁPIDA de acesso (uma única query)
-- Verifica: aluno ativo + plano ativo + não vencido + horário permitido
-- ================================================

CREATE OR REPLACE FUNCTION validate_student_access(
    p_academy_id UUID,
    p_user_id UUID,
    p_current_time TIME DEFAULT LOCALTIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_plan RECORD;
    v_result JSONB;
BEGIN
    -- 1. Buscar usuário
    SELECT u.id, u.name, u.is_active, u.role
    INTO v_user
    FROM users u
    INNER JOIN academy_users au ON au.user_id = u.id
    WHERE u.id = p_user_id
      AND au.academy_id = p_academy_id
    LIMIT 1;

    -- Usuário não encontrado
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'granted', false,
            'reason', 'NAO_ENCONTRADO',
            'message', 'Usuário não encontrado nesta academia'
        );
    END IF;

    -- Usuário inativo/bloqueado
    IF NOT v_user.is_active THEN
        RETURN jsonb_build_object(
            'granted', false,
            'reason', 'BLOQUEADO',
            'message', 'Acesso bloqueado pelo administrador',
            'user_name', v_user.name
        );
    END IF;

    -- 2. Buscar plano ativo do aluno
    SELECT sp.*, p.name AS plan_name,
           p.has_time_restriction,
           p.allowed_start_time,
           p.allowed_end_time
    INTO v_plan
    FROM student_plans sp
    INNER JOIN plans p ON p.id = sp.plan_id
    WHERE sp.student_id = p_user_id
      AND sp.is_active = true
    ORDER BY sp.created_at DESC
    LIMIT 1;

    -- Sem plano ativo
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'granted', false,
            'reason', 'INADIMPLENTE',
            'message', 'Nenhum plano ativo encontrado',
            'user_name', v_user.name
        );
    END IF;

    -- Plano vencido
    IF v_plan.plan_end_date < CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'granted', false,
            'reason', 'PLANO_VENCIDO',
            'message', 'Plano vencido em ' || to_char(v_plan.plan_end_date, 'DD/MM/YYYY'),
            'user_name', v_user.name,
            'plan_name', v_plan.plan_name
        );
    END IF;

    -- 3. Verificação de horário
    IF v_plan.has_time_restriction THEN
        IF p_current_time < v_plan.allowed_start_time::TIME
           OR p_current_time > v_plan.allowed_end_time::TIME THEN
            RETURN jsonb_build_object(
                'granted', false,
                'reason', 'FORA_DO_HORARIO',
                'message', 'Acesso permitido somente entre '
                    || to_char(v_plan.allowed_start_time::TIME, 'HH24:MI')
                    || ' e '
                    || to_char(v_plan.allowed_end_time::TIME, 'HH24:MI'),
                'user_name', v_user.name,
                'plan_name', v_plan.plan_name,
                'allowed_start', v_plan.allowed_start_time,
                'allowed_end', v_plan.allowed_end_time
            );
        END IF;
    END IF;

    -- ✅ Acesso liberado
    RETURN jsonb_build_object(
        'granted', true,
        'reason', 'OK',
        'message', 'Acesso liberado',
        'user_name', v_user.name,
        'plan_name', v_plan.plan_name,
        'plan_end_date', v_plan.plan_end_date
    );
END;
$$;

-- ================================================
-- RPC: get_academy_occupancy
-- Retorna quantidade de pessoas atualmente dentro
-- (entradas - saídas do dia)
-- ================================================

CREATE OR REPLACE FUNCTION get_academy_occupancy(p_academy_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entries INTEGER;
    v_exits INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_entries
    FROM access_logs
    WHERE academy_id = p_academy_id
      AND direction = 'IN'
      AND access_granted = true
      AND created_at::DATE = CURRENT_DATE;

    SELECT COUNT(*) INTO v_exits
    FROM access_logs
    WHERE academy_id = p_academy_id
      AND direction = 'OUT'
      AND access_granted = true
      AND created_at::DATE = CURRENT_DATE;

    RETURN GREATEST(v_entries - v_exits, 0);
END;
$$;

-- ================================================
-- TABELA: pairing_codes
-- Códigos temporários para parear o Agent Local
-- ================================================

CREATE TABLE IF NOT EXISTS pairing_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    turnstile_config_id UUID NOT NULL REFERENCES turnstile_configs(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pairing_codes_code ON pairing_codes(code) WHERE is_used = false;

-- ================================================
-- RPC: generate_pairing_code
-- Gera código de pareamento (válido por 10 min)
-- Formato: PKF-XXXX-XXXX
-- ================================================

CREATE OR REPLACE FUNCTION generate_pairing_code(
    p_academy_id UUID,
    p_turnstile_config_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code TEXT;
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_i INTEGER;
    v_part1 TEXT := '';
    v_part2 TEXT := '';
BEGIN
    -- Invalidar códigos ativos anteriores desta catraca
    UPDATE pairing_codes
    SET is_used = true
    WHERE turnstile_config_id = p_turnstile_config_id
      AND is_used = false;

    -- Gerar parte 1 (4 chars)
    FOR v_i IN 1..4 LOOP
        v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    -- Gerar parte 2 (4 chars)
    FOR v_i IN 1..4 LOOP
        v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    v_code := 'PKF-' || v_part1 || '-' || v_part2;

    -- Inserir código (expira em 10 min)
    INSERT INTO pairing_codes (academy_id, turnstile_config_id, code, expires_at)
    VALUES (p_academy_id, p_turnstile_config_id, v_code, NOW() + INTERVAL '10 minutes');

    RETURN v_code;
END;
$$;

-- ================================================
-- RPC: redeem_pairing_code
-- Valida o código e retorna config completa
-- ================================================

CREATE OR REPLACE FUNCTION redeem_pairing_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pairing RECORD;
    v_config RECORD;
    v_academy RECORD;
BEGIN
    -- Buscar código válido
    SELECT * INTO v_pairing
    FROM pairing_codes
    WHERE code = UPPER(TRIM(p_code))
      AND is_used = false
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Código inválido ou expirado'
        );
    END IF;

    -- Buscar config da catraca
    SELECT * INTO v_config
    FROM turnstile_configs
    WHERE id = v_pairing.turnstile_config_id;

    -- Buscar nome da academia
    SELECT id, name INTO v_academy
    FROM academies
    WHERE id = v_pairing.academy_id;

    -- Marcar código como usado
    UPDATE pairing_codes
    SET is_used = true, used_at = NOW()
    WHERE id = v_pairing.id;

    -- Retornar tudo que o Agent precisa
    RETURN jsonb_build_object(
        'success', true,
        'academy_id', v_academy.id,
        'academy_name', v_academy.name,
        'turnstile_config_id', v_config.id,
        'turnstile_name', v_config.name,
        'brand', v_config.brand,
        'model', v_config.model,
        'ip_address', v_config.ip_address,
        'port', v_config.port,
        'auth_user', v_config.auth_user,
        'auth_password', v_config.auth_password,
        'settings', v_config.settings
    );
END;
$$;

-- ================================================
-- RLS
-- ================================================

ALTER TABLE turnstile_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS POLICIES
-- ================================================

-- turnstile_configs: usuários autenticados podem gerenciar
CREATE POLICY "turnstile_configs_select" ON turnstile_configs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "turnstile_configs_insert" ON turnstile_configs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "turnstile_configs_update" ON turnstile_configs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "turnstile_configs_delete" ON turnstile_configs
    FOR DELETE USING (auth.role() = 'authenticated');

-- access_logs: usuários autenticados podem ler e inserir
CREATE POLICY "access_logs_select" ON access_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "access_logs_insert" ON access_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- access_commands: usuários autenticados podem gerenciar
CREATE POLICY "access_commands_select" ON access_commands
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "access_commands_insert" ON access_commands
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "access_commands_update" ON access_commands
    FOR UPDATE USING (auth.role() = 'authenticated');

-- pairing_codes: usuários autenticados podem gerenciar
CREATE POLICY "pairing_codes_select" ON pairing_codes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pairing_codes_insert" ON pairing_codes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pairing_codes_update" ON pairing_codes
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Service role (Agent) precisa de acesso total
CREATE POLICY "service_role_turnstile_configs" ON turnstile_configs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_access_logs" ON access_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_access_commands" ON access_commands
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_pairing_codes" ON pairing_codes
    FOR ALL USING (auth.role() = 'service_role');
