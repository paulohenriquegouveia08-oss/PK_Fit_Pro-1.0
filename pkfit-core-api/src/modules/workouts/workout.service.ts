import { deactivateExistingWorkouts, insertFullWorkout, updateFullWorkout, deleteWorkoutDb } from './workout.repository.js';
import type { CreateWorkoutInput, UpdateWorkoutInput, DeleteWorkoutInput } from './workout.schema.js';
import type { AuthenticatedUser } from '../../types/common.types.js';

export async function createWorkout(input: CreateWorkoutInput, actor: AuthenticatedUser) {
  // First deactivate any old active workouts for this student
  await deactivateExistingWorkouts(input.student_id);

  // Then create the new one
  return await insertFullWorkout(input);
}

export async function updateWorkout(input: UpdateWorkoutInput, actor: AuthenticatedUser) {
  return await updateFullWorkout(input);
}

export async function deleteWorkout(input: DeleteWorkoutInput, actor: AuthenticatedUser) {
  await deleteWorkoutDb(input.id);
}
