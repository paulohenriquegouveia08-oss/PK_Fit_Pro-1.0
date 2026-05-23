import { insertAccessLog, fetchLastPresence, checkAccessRules } from './access.repository.js';
import type { ValidateAccessInput, CreateAccessLogInput } from './access.schema.js';

export async function validateAccess(input: ValidateAccessInput) {
  return await checkAccessRules(input.academy_id, input.user_id);
}

export async function createAccessLog(input: CreateAccessLogInput) {
  return await insertAccessLog(input);
}

export async function getLastPresence(userId: string, academyId: string) {
  const presence = await fetchLastPresence(userId, academyId);
  return presence || null;
}
