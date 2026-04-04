-- =============================================================
-- pg_cron + pg_net: Agendador automático de Web Push
-- Execute no Supabase SQL Editor DEPOIS da migration das tabelas
-- =============================================================

-- 1. Habilitar as extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar o cron job que chama a Netlify Function a cada 30 segundos
-- IMPORTANTE: Substitua 'SEU_SITE.netlify.app' pela URL real do seu site Netlify
SELECT cron.schedule(
    'send-rest-push-notifications',  -- nome do job
    '30 seconds',                     -- intervalo
    $$
    SELECT net.http_get(
        url := 'https://pkfitpro.netlify.app/api/send-push'
    );

$$ );

-- Para verificar se o job foi criado:
-- SELECT * FROM cron.job;

-- Para remover o job (caso precise reverter):
-- SELECT cron.unschedule('send-rest-push-notifications');