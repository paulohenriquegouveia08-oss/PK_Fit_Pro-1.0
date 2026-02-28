-- ================================================================
-- 📈 EVOLUÇÃO — SQL RPCs para Supabase
-- Execute este SQL no Supabase SQL Editor
-- ================================================================

-- ─── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workout_sessions_student_status 
    ON workout_sessions(student_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_set_logs_session 
    ON workout_set_logs(session_id, exercise_name);

-- ─── RPC 1: Evolução de Carga ─────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_evolucao_carga(
    p_student_id uuid,
    p_days integer DEFAULT 30,
    p_exercise_filter text DEFAULT NULL
)
RETURNS TABLE(
    date text,
    exercise_name text,
    max_load numeric,
    total_volume numeric,
    total_sets bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        to_char(ws.started_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as date,
        wsl.exercise_name,
        MAX(wsl.load_done) as max_load,
        SUM(wsl.load_done * wsl.reps_done) as total_volume,
        COUNT(*) as total_sets
    FROM workout_set_logs wsl
    JOIN workout_sessions ws ON ws.id = wsl.session_id
    WHERE ws.student_id = p_student_id
      AND ws.status = 'concluido'
      AND ws.started_at >= (NOW() - (p_days || ' days')::interval)
      AND (p_exercise_filter IS NULL OR wsl.exercise_name = p_exercise_filter)
    GROUP BY 
        to_char(ws.started_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
        wsl.exercise_name
    ORDER BY date ASC;
$$;

-- ─── RPC 2: Evolução de Repetições ───────────────────────────
CREATE OR REPLACE FUNCTION rpc_evolucao_reps(
    p_student_id uuid,
    p_exercise_name text,
    p_days integer DEFAULT 30
)
RETURNS TABLE(
    date text,
    best_reps integer,
    load_at_best numeric,
    avg_reps integer,
    avg_load numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    WITH daily_sets AS (
        SELECT 
            to_char(ws.started_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as d,
            wsl.reps_done,
            wsl.load_done,
            ROW_NUMBER() OVER (
                PARTITION BY to_char(ws.started_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')
                ORDER BY wsl.reps_done DESC, wsl.load_done DESC
            ) as rn
        FROM workout_set_logs wsl
        JOIN workout_sessions ws ON ws.id = wsl.session_id
        WHERE ws.student_id = p_student_id
          AND ws.status = 'concluido'
          AND wsl.exercise_name = p_exercise_name
          AND ws.started_at >= (NOW() - (p_days || ' days')::interval)
    ),
    daily_agg AS (
        SELECT 
            d,
            MAX(reps_done) as best_reps,
            ROUND(AVG(reps_done))::integer as avg_reps,
            ROUND(AVG(load_done)) as avg_load
        FROM daily_sets
        GROUP BY d
    ),
    daily_best AS (
        SELECT d, load_done as load_at_best
        FROM daily_sets WHERE rn = 1
    )
    SELECT 
        da.d as date,
        da.best_reps::integer,
        db.load_at_best,
        da.avg_reps,
        da.avg_load
    FROM daily_agg da
    JOIN daily_best db ON da.d = db.d
    ORDER BY da.d ASC;
$$;

-- ─── RPC 3: Frequência de Treino ─────────────────────────────
CREATE OR REPLACE FUNCTION rpc_frequencia_treino(
    p_student_id uuid,
    p_days integer DEFAULT 30
)
RETURNS TABLE(
    date text,
    trained boolean,
    session_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    WITH date_range AS (
        SELECT generate_series(
            (CURRENT_DATE - (p_days || ' days')::interval)::date,
            CURRENT_DATE,
            '1 day'::interval
        )::date as d
    ),
    trained_days AS (
        SELECT 
            (ws.started_at AT TIME ZONE 'America/Sao_Paulo')::date as d,
            COUNT(*) as cnt
        FROM workout_sessions ws
        WHERE ws.student_id = p_student_id
          AND ws.status = 'concluido'
          AND ws.started_at >= (NOW() - (p_days || ' days')::interval)
        GROUP BY (ws.started_at AT TIME ZONE 'America/Sao_Paulo')::date
    )
    SELECT 
        to_char(dr.d, 'YYYY-MM-DD') as date,
        (td.cnt IS NOT NULL) as trained,
        COALESCE(td.cnt, 0) as session_count
    FROM date_range dr
    LEFT JOIN trained_days td ON dr.d = td.d
    ORDER BY dr.d ASC;
$$;
