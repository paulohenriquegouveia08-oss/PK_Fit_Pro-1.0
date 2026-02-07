/**
 * Storage Service - Gerenciador de localStorage com expiração automática
 * Usado para persistência de sessão e cache de dados
 */

interface StorageItem<T> {
    data: T;
    expiresAt: number;
    userId?: string;
}

const STORAGE_PREFIX = 'pkfit_';

/**
 * Salva um item no localStorage com expiração
 */
export function setStorageItem<T>(
    key: string,
    data: T,
    expirationMinutes: number,
    userId?: string
): void {
    const item: StorageItem<T> = {
        data,
        expiresAt: Date.now() + expirationMinutes * 60 * 1000,
        userId
    };
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(item));
}

/**
 * Recupera um item do localStorage se ainda válido
 */
export function getStorageItem<T>(key: string): T | null {
    try {
        const itemStr = localStorage.getItem(STORAGE_PREFIX + key);
        if (!itemStr) return null;

        const item: StorageItem<T> = JSON.parse(itemStr);

        // Verifica expiração
        if (Date.now() > item.expiresAt) {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return null;
        }

        return item.data;
    } catch {
        return null;
    }
}

/**
 * Remove um item específico do localStorage
 */
export function removeStorageItem(key: string): void {
    localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * Verifica se um item está expirado
 */
export function isStorageItemExpired(key: string): boolean {
    try {
        const itemStr = localStorage.getItem(STORAGE_PREFIX + key);
        if (!itemStr) return true;

        const item = JSON.parse(itemStr);
        return Date.now() > item.expiresAt;
    } catch {
        return true;
    }
}

/**
 * Remove todos os dados associados a um usuário específico
 */
export function clearUserData(userId: string): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
            try {
                const itemStr = localStorage.getItem(key);
                if (itemStr) {
                    const item = JSON.parse(itemStr);
                    if (item.userId === userId) {
                        keysToRemove.push(key);
                    }
                }
            } catch {
                // Ignora erros de parsing
            }
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Limpa todos os dados do PK Fit Pro do localStorage
 */
export function clearAllStorageData(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
}

// Constantes de configuração
export const STORAGE_KEYS = {
    USER_SESSION: 'user_session',
    WORKOUT_CACHE: 'workout_cache'
} as const;

export const EXPIRATION = {
    SESSION_DAYS: 7,
    SESSION_MINUTES: 7 * 24 * 60, // 7 dias em minutos
    WORKOUT_CACHE_MINUTES: 30
} as const;
