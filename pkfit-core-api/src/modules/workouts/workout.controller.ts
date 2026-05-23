import type { FastifyRequest, FastifyReply } from 'fastify';
import { createWorkoutSchema, updateWorkoutSchema, deleteWorkoutSchema } from './workout.schema.js';
import { createWorkout, updateWorkout, deleteWorkout } from './workout.service.js';
import { audit } from '../audit/audit.service.js';

export async function createWorkoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createWorkoutSchema.parse(request.body);
  const result = await createWorkout(input, request.currentUser!);

  await audit(request, 'workout.create', { 
    targetType: 'user', 
    targetId: input.student_id,
    metadata: { workout_id: result.id, professor_id: input.professor_id }
  });
  
  reply.status(201).send({ success: true, data: result });
}

export async function updateWorkoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as any;
  const input = updateWorkoutSchema.parse({ ...request.body as any, id: params.id });
  
  const result = await updateWorkout(input, request.currentUser!);
  
  await audit(request, 'workout.update', { 
    targetType: 'workout', 
    targetId: result.id,
    metadata: { student_id: input.student_id }
  });
  
  reply.status(200).send({ success: true, data: result });
}

export async function deleteWorkoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = deleteWorkoutSchema.parse(request.params);
  
  await deleteWorkout(input, request.currentUser!);
  
  await audit(request, 'workout.delete', { targetType: 'workout', targetId: input.id });
  reply.status(200).send({ success: true, message: 'Treino excluído com sucesso' });
}
