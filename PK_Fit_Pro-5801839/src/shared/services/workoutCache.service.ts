/**
 * Workout Cache Service - Cache local para fichas de treino
 * Reduz requisições ao backend durante sessões de treino
 */

import {
    setStorageItem,
    getStorageItem,
    removeStorageItem,
    STORAGE_KEYS,
    EXPIRATION
} from './storage.service';
import type { Workout } from './workout.service';

/**
 * Gera a chave de cache para um aluno específico
 */
function getCacheKey(studentId: string): string {
    return `${STORAGE_KEYS.WORKOUT_CACHE}_${studentId}`;
}

/**
 * Recupera o treino do cache se válido
 */
export function getCachedWorkout(studentId: string): Workout | null {
    const cacheKey = getCacheKey(studentId);
    return getStorageItem<Workout>(cacheKey);
}

/**
 * Salva o treino no cache
 */
export function setCachedWorkout(studentId: string, workout: Workout, userId: string): void {
    const cacheKey = getCacheKey(studentId);
    setStorageItem(
        cacheKey,
        workout,
        EXPIRATION.WORKOUT_CACHE_MINUTES,
        userId
    );
}

/**
 * Invalida o cache de um aluno específico
 */
export function invalidateWorkoutCache(studentId: string): void {
    const cacheKey = getCacheKey(studentId);
    removeStorageItem(cacheKey);
}

/**
 * Verifica se existe cache válido para um aluno
 */
export function hasValidCache(studentId: string): boolean {
    return getCachedWorkout(studentId) !== null;
}
