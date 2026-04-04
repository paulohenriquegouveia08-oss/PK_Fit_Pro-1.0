-- =============================================================
-- Web Push Notifications — Tabelas + pg_cron
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

-- 1. Tabela de Subscriptions (dispositivos registrados para push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, endpoint)
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON push_subscriptions FOR ALL USING (auth.uid () = user_id)
WITH
    CHECK (auth.uid () = user_id);

-- 2. Tabela de Pushes Pendentes (fila de notificações agendadas)
CREATE TABLE IF NOT EXISTS pending_push (
    id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    send_at timestamptz NOT NULL,
    title text NOT NULL DEFAULT '🔔 Descanso Finalizado!',
    body text NOT NULL DEFAULT 'Hora de voltar para a próxima série! 💪',
    sent boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE pending_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pending pushes" ON pending_push FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can delete own pending pushes" ON pending_push FOR DELETE USING (auth.uid () = user_id);

-- Index para consulta rápida do cron
CREATE INDEX idx_pending_push_send_at ON pending_push (send_at)
WHERE
    sent = false;

-- 3. Permitir que a Netlify Function leia/delete via service_role
-- (A Netlify Function usará a SUPABASE_SERVICE_ROLE_KEY)
CREATE POLICY "Service role full access to pending_push" ON pending_push FOR ALL USING (true)
WITH
    CHECK (true);

CREATE POLICY "Service role full access to push_subscriptions" ON push_subscriptions FOR ALL USING (true)
WITH
    CHECK (true);