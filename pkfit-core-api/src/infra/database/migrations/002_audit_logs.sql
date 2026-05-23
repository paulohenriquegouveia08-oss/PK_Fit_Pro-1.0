-- ================================================
-- TABELA: audit_logs
-- Log de ações críticas para rastreabilidade
-- ================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,                         -- Quem executou a ação
    actor_role VARCHAR(30),
    action VARCHAR(100) NOT NULL,          -- 'invite.create', 'invite.redeem', 'academy.create'
    target_type VARCHAR(50),               -- 'invite', 'academy', 'user'
    target_id UUID,
    academy_id UUID,                       -- Contexto multi-tenant
    metadata JSONB DEFAULT '{}',           -- Detalhes da ação
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_academy ON audit_logs(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'audit_logs'
          AND policyname = 'Service role full access audit_logs'
    ) THEN
        CREATE POLICY "Service role full access audit_logs"
            ON audit_logs FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
