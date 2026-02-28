import type { LogLevel } from '../config';
declare class Logger {
    private minLevel;
    setLevel(level: LogLevel): void;
    private shouldLog;
    private formatTimestamp;
    private log;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    divider(label?: string): void;
    access(granted: boolean, userName: string, reason: string): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map