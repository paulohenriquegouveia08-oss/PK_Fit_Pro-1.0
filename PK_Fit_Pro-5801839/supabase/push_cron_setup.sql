-- =============================================================
-- pg_cron: Atualizado para usar /api/cron-push (sempre retorna 200)
-- Execute no Supabase SQL Editor
-- =============================================================

-- 1. Remove o job antigo (se existir)
SELECT cron.unschedule ( 'send-rest-push-notifications' );

-- 2. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Criar novo job com endpoint que sempre retorna 200
SELECT cron.schedule(
    'send-rest-push-notifications',
    '30 seconds',
    $$
    SELECT net.http_get(
        url := 'https://pkfitpro.netlify.app/api/cron-push'
    );

$$ );

-- Verificar:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;