-- ================================================
-- SUPABASE SCHEMA - SAAS GYM MANAGEMENT SYSTEM
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- ENUM TYPES
-- ================================================

CREATE TYPE user_role AS ENUM (
  'ADMIN_GLOBAL',
  'ADMIN_ACADEMIA',
  'PROFESSOR',
  'ALUNO'
);

CREATE TYPE academy_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'PAID',
  'OVERDUE'
);

CREATE TYPE workout_request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- ================================================
-- USERS TABLE
-- ================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookup (login flow)
CREATE INDEX idx_users_email ON users(email);

-- ================================================
-- ACADEMIES TABLE
-- ================================================

CREATE TABLE academies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  status academy_status DEFAULT 'ACTIVE',
  plan_name VARCHAR(100),
  plan_value DECIMAL(10, 2),
  payment_status payment_status DEFAULT 'PENDING',
  payment_due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- ACADEMY_USERS TABLE (relationship between users and academies)
-- ================================================

CREATE TABLE academy_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(academy_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_academy_users_academy ON academy_users(academy_id);
CREATE INDEX idx_academy_users_user ON academy_users(user_id);

-- ================================================
-- PROFESSOR_STUDENTS TABLE (relationship between professors and students)
-- ================================================

CREATE TABLE professor_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(professor_id, student_id)
);

-- Indexes
CREATE INDEX idx_professor_students_professor ON professor_students(professor_id);
CREATE INDEX idx_professor_students_student ON professor_students(student_id);

-- ================================================
-- EXERCISES TABLE (catalog of exercises)
-- ================================================

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  muscle_group VARCHAR(100),
  equipment VARCHAR(100),
  description TEXT,
  video_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- WORKOUTS TABLE
-- ================================================

CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  day_of_week VARCHAR(20), -- 'MONDAY', 'TUESDAY', etc. or 'A', 'B', 'C'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workouts_student ON workouts(student_id);
CREATE INDEX idx_workouts_professor ON workouts(professor_id);

-- ================================================
-- WORKOUT_EXERCISES TABLE
-- ================================================

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name VARCHAR(255) NOT NULL, -- Denormalized for custom exercises
  sets INTEGER NOT NULL,
  reps VARCHAR(50), -- Can be "12", "10-12", "Until failure"
  rest_seconds INTEGER,
  load VARCHAR(50), -- Can be weight or observation
  notes TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);

-- ================================================
-- WORKOUT_REQUESTS TABLE
-- ================================================

CREATE TABLE workout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- 'NEW_WORKOUT', 'CHANGE_WORKOUT'
  message TEXT,
  status workout_request_status DEFAULT 'PENDING',
  response_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_workout_requests_student ON workout_requests(student_id);
CREATE INDEX idx_workout_requests_professor ON workout_requests(professor_id);
CREATE INDEX idx_workout_requests_status ON workout_requests(status);

-- ================================================
-- NOTIFICATIONS TABLE
-- ================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ================================================
-- TRIGGER: Update updated_at timestamp
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academies_updated_at
  BEFORE UPDATE ON academies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- INITIAL DATA: Admin Global
-- ================================================

INSERT INTO users (email, name, role, is_active)
VALUES ('paulohenriquegouveia08@gmail.com', 'Admin Global', 'ADMIN_GLOBAL', true);

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (bypass RLS)
-- Note: In production, configure proper RLS policies based on user context
