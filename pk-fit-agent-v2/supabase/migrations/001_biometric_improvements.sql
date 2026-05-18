-- ==========================================
-- MIGRATION: Biometric Module Improvements
-- Created: 2026-05-16
-- Description: Tabelas para suporte a mapeamento UUID->provider_user_id,
--   persistência de fila, heartbeat, auditoria e circuit breaker
-- ==========================================

-- ==========================================
-- Tabela: user_turnstile_mapping
-- purpose: Mapear UUIDs do sistema para IDs numéricos do hardware
-- ==========================================
CREATE TABLE IF NOT EXISTS user_turnstile_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    academy_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'CONTROL_ID',
    provider_user_id VARCHAR(100) NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(academy_id, user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_turnstile_mapping_user_id ON user_turnstile_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_turnstile_mapping_provider_id ON user_turnstile_mapping(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_user_turnstile_mapping_academy ON user_turnstile_mapping(academy_id);

-- ==========================================
-- Tabela: face_sync_queue (para persistência local via agent)
-- purpose: Registrar comandos de sync facial para processamento
-- ==========================================
CREATE TABLE IF NOT EXISTS face_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_face_sync_queue_status ON face_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_face_sync_queue_user_id ON face_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_face_sync_queue_created ON face_sync_queue(created_at);

-- ==========================================
-- Tabela: face_sync_logs (auditoria)
-- purpose: Log detalhado de todas as operações de sincronização
-- ==========================================
CREATE TABLE IF NOT EXISTS face_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    academy_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    duration_ms INTEGER,
    raw_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_sync_logs_user_id ON face_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_face_sync_logs_academy ON face_sync_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_face_sync_logs_status ON face_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_face_sync_logs_created ON face_sync_logs(created_at);

-- ==========================================
-- Tabela: agent_heartbeats
-- purpose: Monitoramento de status dos agentes desktop
-- ==========================================
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    version VARCHAR(50),
    ip_address VARCHAR(45),
    uptime_seconds INTEGER DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(academy_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_academy ON agent_heartbeats(academy_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_status ON agent_heartbeats(status);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_last_seen ON agent_heartbeats(last_seen);

-- ==========================================
-- Tabela: circuit_breaker_state
-- purpose: Controlar estado do circuit breaker por provider
-- ==========================================
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL UNIQUE,
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Funções RPC para operações específicas
-- ==========================================

-- Gerar provider_user_id único para um usuário
CREATE OR REPLACE FUNCTION generate_provider_user_id(
    p_user_id UUID,
    p_academy_id UUID,
    p_provider VARCHAR
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_provider_id VARCHAR;
BEGIN
    -- Gera um ID baseado em timestamp + hash do user_id
    -- Formato: ACADEMY_HEX(4) + TIMESTAMP_HEX(8) + RANDOM_HEX(4)
    v_provider_id := 
        LPAD(ENCODE(Digest(p_academy_id::bytea, 'md5')::bit(32)::int % 10000, 'hex'), 4, '0') ||
        LPAD(TO_HEX(EXTRACT(EPOCH FROM NOW())::int), 8, '0') ||
        LPAD(ENCODE(Digest(gen_random_bytes(4), 'md5'), 'hex'), 4, '0');

    RETURN v_provider_id;
END;
$$;

-- Criar ou atualizar mapeamento
CREATE OR REPLACE FUNCTION upsert_user_mapping(
    p_user_id UUID,
    p_academy_id UUID,
    p_provider VARCHAR,
    p_provider_user_id VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO user_turnstile_mapping (user_id, academy_id, provider, provider_user_id, synced_at)
    VALUES (p_user_id, p_academy_id, p_provider, p_provider_user_id, NOW())
    ON CONFLICT (academy_id, user_id, provider)
    DO UPDATE SET 
        provider_user_id = EXCLUDED.provider_user_id,
        synced_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Obter provider_user_id por user_id
CREATE OR REPLACE FUNCTION get_provider_user_id(
    p_user_id UUID,
    p_academy_id UUID,
    p_provider VARCHAR DEFAULT 'CONTROL_ID'
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_provider_id VARCHAR;
BEGIN
    SELECT provider_user_id INTO v_provider_id
    FROM user_turnstile_mapping
    WHERE user_id = p_user_id 
      AND academy_id = p_academy_id 
      AND provider = p_provider;

    RETURN v_provider_id;
END;
$$;

-- Registrar log de sincronização
CREATE OR REPLACE FUNCTION log_face_sync(
    p_user_id UUID,
    p_academy_id UUID,
    p_provider VARCHAR,
    p_provider_user_id VARCHAR,
    p_status VARCHAR,
    p_message TEXT,
    p_duration_ms INTEGER,
    p_raw_response TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO face_sync_logs (
        user_id, academy_id, provider, provider_user_id,
        status, message, duration_ms, raw_response
    )
    VALUES (
        p_user_id, p_academy_id, p_provider, p_provider_user_id,
        p_status, p_message, p_duration_ms, p_raw_response
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Atualizar heartbeat do agent
CREATE OR REPLACE FUNCTION upsert_agent_heartbeat(
    p_academy_id UUID,
    p_device_id VARCHAR,
    p_device_name VARCHAR,
    p_version VARCHAR,
    p_ip_address VARCHAR,
    p_uptime_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO agent_heartbeats (
        academy_id, device_id, device_name, status,
        version, ip_address, uptime_seconds, last_seen
    )
    VALUES (
        p_academy_id, p_device_id, p_device_name, 'ONLINE',
        p_version, p_ip_address, p_uptime_seconds, NOW()
    )
    ON CONFLICT (academy_id, device_id)
    DO UPDATE SET
        device_name = EXCLUDED.device_name,
        status = 'ONLINE',
        version = EXCLUDED.version,
        ip_address = EXCLUDED.ip_address,
        uptime_seconds = EXCLUDED.uptime_seconds,
        last_seen = NOW();
END;
$$;

-- Atualizar estado do circuit breaker
CREATE OR REPLACE FUNCTION update_circuit_breaker(
    p_provider VARCHAR,
    p_state VARCHAR,
    p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO circuit_breaker_state (provider, state, failure_count, last_failure_at, last_success_at)
    VALUES (
        p_provider,
        p_state,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        CASE WHEN NOT p_success THEN NOW() ELSE NULL END,
        CASE WHEN p_success THEN NOW() ELSE NULL END
    )
    ON CONFLICT (provider)
    DO UPDATE SET
        state = p_state,
        failure_count = CASE 
            WHEN p_success THEN 0 
            ELSE circuit_breaker_state.failure_count + 1 
        END,
        last_failure_at = CASE 
            WHEN NOT p_success THEN NOW() 
            ELSE circuit_breaker_state.last_failure_at 
        END,
        last_success_at = CASE 
            WHEN p_success THEN NOW() 
            ELSE circuit_breaker_state.last_success_at 
        END,
        opened_at = CASE 
            WHEN p_state = 'OPEN' AND circuit_breaker_state.state != 'OPEN' THEN NOW()
            ELSE circuit_breaker_state.opened_at
        END,
        updated_at = NOW();
END;
$$;

-- Obter estado do circuit breaker
CREATE OR REPLACE FUNCTION get_circuit_breaker_state(p_provider VARCHAR)
RETURNS TABLE(
    state VARCHAR,
    failure_count INTEGER,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cb.state,
        cb.failure_count,
        cb.last_failure_at,
        cb.opened_at
    FROM circuit_breaker_state cb
    WHERE cb.provider = p_provider;
END;
$$;

-- Verificar se agent está online (último heartbeat nos últimos 60 segundos)
CREATE OR REPLACE FUNCTION is_agent_online(p_academy_id UUID, p_device_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_seen TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT last_seen INTO v_last_seen
    FROM agent_heartbeats
    WHERE academy_id = p_academy_id AND device_id = p_device_id;

    IF v_last_seen IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN (NOW() - v_last_seen) < INTERVAL '60 seconds';
END;
$$;