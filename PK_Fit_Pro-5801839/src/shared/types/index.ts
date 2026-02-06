// User Roles
export type UserRole = 'ADMIN_GLOBAL' | 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO';

// Academy Status
export type AcademyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// Payment Status
export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE';

// Workout Request Status
export type WorkoutRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// User Interface
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Academy Interface
export interface Academy {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status: AcademyStatus;
  plan_name?: string;
  plan_value?: number;
  payment_status: PaymentStatus;
  payment_due_date?: string;
  created_at: string;
  updated_at: string;
}

// Academy User Relationship
export interface AcademyUser {
  id: string;
  academy_id: string;
  user_id: string;
  created_at: string;
}

// Professor-Student Relationship
export interface ProfessorStudent {
  id: string;
  professor_id: string;
  student_id: string;
  created_at: string;
}

// Exercise Interface
export interface Exercise {
  id: string;
  name: string;
  muscle_group?: string;
  equipment?: string;
  description?: string;
  video_url?: string;
  created_at: string;
}

// Workout Interface
export interface Workout {
  id: string;
  student_id: string;
  professor_id: string;
  name: string;
  description?: string;
  day_of_week?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Workout Exercise Interface
export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id?: string;
  exercise_name: string;
  sets: number;
  reps?: string;
  rest_seconds?: number;
  load?: string;
  notes?: string;
  order_index: number;
  created_at: string;
}

// Workout Request Interface
export interface WorkoutRequest {
  id: string;
  student_id: string;
  professor_id: string;
  request_type: 'NEW_WORKOUT' | 'CHANGE_WORKOUT';
  message?: string;
  status: WorkoutRequestStatus;
  response_message?: string;
  created_at: string;
  responded_at?: string;
}

// Notification Interface
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

// Auth State
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Login Step Type
export type LoginStep = 'email' | 'password' | 'create-password';

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
