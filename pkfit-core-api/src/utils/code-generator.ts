import { INVITE_CODE_PREFIXES, type InviteType } from '../types/common.types.js';

/**
 * Alphabet for invite code generation.
 * Excludes ambiguous characters: 0, O, 1, I, L
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generates a cryptographically random invite code.
 *
 * Format: PK-ACA-XXXXXX  (6 random chars)
 * Example: PK-ACA-7K3N9P
 */
export function generateInviteCode(type: InviteType): string {
  const prefix = INVITE_CODE_PREFIXES[type];
  let code = '';

  // Use crypto.getRandomValues for secure randomness
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomBytes[i] % ALPHABET.length];
  }

  return `${prefix}-${code}`;
}

/**
 * Validates the format of an invite code.
 * Returns true if the code matches expected pattern.
 */
export function isValidCodeFormat(code: string): boolean {
  return /^PK-(ACA|PRF|ALN)-[A-Z0-9]{6}$/.test(code.toUpperCase().trim());
}

/**
 * Extracts the invite type from a code prefix.
 */
export function getTypeFromCode(code: string): InviteType | null {
  const upper = code.toUpperCase().trim();
  if (upper.startsWith('PK-ACA-')) return 'academy_invite';
  if (upper.startsWith('PK-PRF-')) return 'teacher_invite';
  if (upper.startsWith('PK-ALN-')) return 'student_invite';
  return null;
}
