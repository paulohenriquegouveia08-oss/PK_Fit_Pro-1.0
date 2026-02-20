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
  academy_id?: string; // Added for session storage of academy info
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

// Plan Interface
export interface Plan {
  id: string;
  academy_id: string;
  name: string;
  price: number;
  duration_in_months: number;
  has_time_restriction: boolean;
  allowed_start_time?: string;
  allowed_end_time?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Student Plan Interface
export interface StudentPlan {
  id: string;
  student_id: string;
  plan_id: string;
  academy_id: string;
  plan_start_date: string;
  plan_end_date: string;
  is_active: boolean;
  created_at: string;
  plan_name?: string;
  plan_price?: number;
  plan_duration?: number;
  plan_has_time_restriction?: boolean;
  plan_allowed_start_time?: string;
  plan_allowed_end_time?: string;
}

// Payment Status
export type PaymentStatusType = 'pago' | 'pendente' | 'cancelado';

// Payment Interface
export interface Payment {
  id: string;
  academy_id: string;
  student_id?: string;
  plan_id?: string;
  amount: number;
  status: PaymentStatusType;
  payment_date: string;
  description?: string;
  created_at: string;
}

// Expense Interface
export interface Expense {
  id: string;
  academy_id: string;
  description: string;
  category?: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

// Financial Summary
export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

// Chart Data Point
export interface ChartDataPoint {
  label: string;
  revenue: number;
  expenses: number;
}

// Plan Distribution
export interface PlanDistribution {
  id: string;
  name: string;
  duration_in_months: number;
  price: number;
  student_count: number;
}

// Student Plan Detail (drill-down)
export interface StudentPlanDetail {
  student_id: string;
  student_name: string;
  plan_start_date: string;
  plan_end_date: string;
  plan_price: number;
  payment_status: 'pago' | 'nao_pago';
}

// Payment Detail (drill-down)
export interface PaymentDetail {
  id: string;
  payment_date: string;
  amount: number;
  status: string;
  student_name?: string;
  plan_name?: string;
  description?: string;
}

// Expense Detail (drill-down)
export interface ExpenseDetail {
  id: string;
  expense_date: string;
  description: string;
  category?: string;
  amount: number;
}

// Plan with Revenue (drill-down)
export interface PlanWithRevenue {
  id: string;
  name: string;
  duration_in_months: number;
  price: number;
  student_count: number;
  total_revenue: number;
}

// Paid/Unpaid Counts
export interface PaidUnpaidCounts {
  paid: number;
  unpaid: number;
}

// Paid/Unpaid Student
export interface PaidUnpaidStudent {
  id: string;
  name: string;
  email: string;
  plan_name?: string;
  plan_price?: number;
  payment_date?: string;
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
