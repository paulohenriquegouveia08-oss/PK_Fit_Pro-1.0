-- ================================================
-- FIX USER DELETION POLICIES
-- Execute este script no SQL Editor do Supabase
-- ================================================

-- 1. Habilitar RLS na tabela users (garantir que está ativo)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "Allow all users operations" ON users;
DROP POLICY IF EXISTS "Allow public registration" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to read users" ON users;

-- 3. Criar uma política permissiva para todas as operações
-- Isso permite que a aplicação (via anon key) faça CRUD completo
-- Em produção, você deve restringir isso com base no auth.uid() e role
CREATE POLICY "Allow all users operations" 
ON users 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Garantir que as tabelas relacionadas tenham ON DELETE CASCADE
-- Isso recria as constraints caso não estejam configuradas corretamente

-- Academy Users
ALTER TABLE academy_users 
DROP CONSTRAINT IF EXISTS academy_users_user_id_fkey;

ALTER TABLE academy_users
ADD CONSTRAINT academy_users_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Professor Students (professor side)
ALTER TABLE professor_students
DROP CONSTRAINT IF EXISTS professor_students_professor_id_fkey;

ALTER TABLE professor_students
ADD CONSTRAINT professor_students_professor_id_fkey
FOREIGN KEY (professor_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Professor Students (student side)
ALTER TABLE professor_students
DROP CONSTRAINT IF EXISTS professor_students_student_id_fkey;

ALTER TABLE professor_students
ADD CONSTRAINT professor_students_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Workouts (student side)
ALTER TABLE workouts
DROP CONSTRAINT IF EXISTS workouts_student_id_fkey;

ALTER TABLE workouts
ADD CONSTRAINT workouts_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Workouts (professor side)
ALTER TABLE workouts
DROP CONSTRAINT IF EXISTS workouts_professor_id_fkey;

ALTER TABLE workouts
ADD CONSTRAINT workouts_professor_id_fkey
FOREIGN KEY (professor_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Workout Requests (student side)
ALTER TABLE workout_requests
DROP CONSTRAINT IF EXISTS workout_requests_student_id_fkey;

ALTER TABLE workout_requests
ADD CONSTRAINT workout_requests_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Workout Requests (professor side)
ALTER TABLE workout_requests
DROP CONSTRAINT IF EXISTS workout_requests_professor_id_fkey;

ALTER TABLE workout_requests
ADD CONSTRAINT workout_requests_professor_id_fkey
FOREIGN KEY (professor_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- Notifications
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;
