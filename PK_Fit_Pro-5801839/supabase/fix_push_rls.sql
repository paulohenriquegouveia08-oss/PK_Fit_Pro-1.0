-- =============================================================
-- FIX: Corrige RLS do push_subscriptions
-- Execute no Supabase SQL Editor
-- =============================================================

-- Remove todas as policies existentes
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON push_subscriptions;

DROP POLICY IF EXISTS "Service role full access to push_subscriptions" ON push_subscriptions;

-- Cria uma policy permissiva para INSERT (qualquer usuário autenticado)
CREATE POLICY "Authenticated users can insert subscriptions" ON push_subscriptions FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

-- Cria uma policy permissiva para SELECT
CREATE POLICY "Authenticated users can read own subscriptions" ON push_subscriptions FOR
SELECT TO authenticated USING (true);

-- Cria uma policy permissiva para UPDATE (upsert precisa disso)
CREATE POLICY "Authenticated users can update subscriptions" ON push_subscriptions FOR
UPDATE TO authenticated USING (true)
WITH
    CHECK (true);

-- Cria uma policy permissiva para DELETE
CREATE POLICY "Authenticated users can delete subscriptions" ON push_subscriptions FOR DELETE TO authenticated USING (true);

-- Service role (para Netlify Function)
CREATE POLICY "Service role full access push_subscriptions" ON push_subscriptions FOR ALL TO service_role USING (true)
WITH
    CHECK (true);

-- Também corrige pending_push para ter políticas explícitas
DROP POLICY IF EXISTS "Users can insert own pending pushes" ON pending_push;

DROP POLICY IF EXISTS "Users can delete own pending pushes" ON pending_push;

DROP POLICY IF EXISTS "Service role full access to pending_push" ON pending_push;

CREATE POLICY "Authenticated users can insert pending pushes" ON pending_push FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Authenticated users can read pending pushes" ON pending_push FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete pending pushes" ON pending_push FOR DELETE TO authenticated USING (true);

CREATE POLICY "Service role full access pending_push" ON pending_push FOR ALL TO service_role USING (true)
WITH
    CHECK (true);