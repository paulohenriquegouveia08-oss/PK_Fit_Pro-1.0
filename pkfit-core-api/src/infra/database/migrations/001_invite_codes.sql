-- ================================================
-- TABELA: invite_codes
-- Sistema de convites para onboarding seguro
-- ================================================

CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL,            -- 'academy_invite', 'teacher_invite', 'student_invite'
    academy_id UUID REFERENCES academies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES auth.users(id),
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',          -- { plan_name, plan_value, professor_id, etc. }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_invite_type CHECK (type IN ('academy_invite', 'teacher_invite', 'student_invite')),
    CONSTRAINT chk_max_uses CHECK (max_uses >= 1),
    CONSTRAINT chk_current_uses CHECK (current_uses >= 0 AND current_uses <= max_uses)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invite_codes_academy ON invite_codes(academy_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_type ON invite_codes(type, is_active);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires ON invite_codes(expires_at) WHERE is_active = true;

-- RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode manipular invites (a API usa service_role)
-- Removido IF NOT EXISTS pois não é suportado em políticas PostgreSQL diretamente desta forma, 
-- é melhor recriar se necessário ou assumir que a migration roda em um banco limpo.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'invite_codes'
          AND policyname = 'Service role full access invite_codes'
    ) THEN
        CREATE POLICY "Service role full access invite_codes"
            ON invite_codes FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END
$$;
