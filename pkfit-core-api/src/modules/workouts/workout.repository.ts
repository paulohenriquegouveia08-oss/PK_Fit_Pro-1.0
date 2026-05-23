import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { CreateWorkoutInput, UpdateWorkoutInput } from './workout.schema.js';

const supabase = () => getSupabaseAdmin();

export async function deactivateExistingWorkouts(studentId: string) {
  const { error } = await supabase()
    .from('workouts')
    .update({ is_active: false })
    .eq('student_id', studentId)
    .eq('is_active', true);
    
  if (error) throw new Error(`Erro ao desativar treinos antigos: ${error.message}`);
}

export async function insertFullWorkout(input: CreateWorkoutInput) {
  // Using multiple inserts but handled atomically via supabase constraints or careful sequencing.
  // Ideally, this could use an RPC, but doing it from backend is already safer than frontend.
  
  const { data: workout, error: workoutError } = await supabase()
    .from('workouts')
    .insert({
      student_id: input.student_id,
      professor_id: input.professor_id,
      is_active: true,
    })
    .select()
    .single();

  if (workoutError) throw new Error(`Erro ao criar cabeçalho do treino: ${workoutError.message}`);

  for (const day of input.days) {
    const { data: workoutDay, error: dayError } = await supabase()
      .from('workout_days')
      .insert({
        workout_id: workout.id,
        day_label: day.day_label,
        day_name: day.day_name,
      })
      .select()
      .single();

    if (dayError) throw new Error(`Erro ao criar dia de treino: ${dayError.message}`);

    if (day.exercises.length > 0) {
      const exercisesData = day.exercises.map((ex, index) => ({
        workout_day_id: workoutDay.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest,
        load: ex.load || null,
        notes: ex.notes || null,
        order_index: index,
      }));

      const { error: exercisesError } = await supabase()
        .from('exercises')
        .insert(exercisesData);

      if (exercisesError) throw new Error(`Erro ao inserir exercícios: ${exercisesError.message}`);
    }
  }

  return workout;
}

export async function updateFullWorkout(input: UpdateWorkoutInput) {
  // Delete existing days (cascade will delete exercises in DB)
  const { error: delError } = await supabase()
    .from('workout_days')
    .delete()
    .eq('workout_id', input.id);

  if (delError) throw new Error(`Erro ao limpar dias antigos do treino: ${delError.message}`);

  for (const day of input.days) {
    const { data: workoutDay, error: dayError } = await supabase()
      .from('workout_days')
      .insert({
        workout_id: input.id,
        day_label: day.day_label,
        day_name: day.day_name,
      })
      .select()
      .single();

    if (dayError) throw new Error(`Erro ao criar dia de treino: ${dayError.message}`);

    if (day.exercises.length > 0) {
      const exercisesData = day.exercises.map((ex, index) => ({
        workout_day_id: workoutDay.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest,
        load: ex.load || null,
        notes: ex.notes || null,
        order_index: index,
      }));

      const { error: exercisesError } = await supabase()
        .from('exercises')
        .insert(exercisesData);

      if (exercisesError) throw new Error(`Erro ao inserir exercícios: ${exercisesError.message}`);
    }
  }

  const updatePayload: any = { updated_at: new Date().toISOString() };
  if (input.professor_id) {
    updatePayload.professor_id = input.professor_id;
  }

  const { data: workout, error: updateError } = await supabase()
    .from('workouts')
    .update(updatePayload)
    .eq('id', input.id)
    .select()
    .single();

  if (updateError) throw new Error(`Erro ao atualizar treino: ${updateError.message}`);
  
  return workout;
}

export async function deleteWorkoutDb(workoutId: string) {
  const { error } = await supabase()
    .from('workouts')
    .delete()
    .eq('id', workoutId);

  if (error) throw new Error(`Erro ao excluir treino: ${error.message}`);
}
