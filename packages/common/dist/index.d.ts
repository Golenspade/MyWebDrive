export interface AppError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: AppError;
};
export declare function ok<T>(data: T): Result<T>;
export declare function err(code: string, message: string, details?: Record<string, unknown>): Result<never>;
export declare function getEnv(key: string, fallback?: string): string;
export declare function requireEnvs(keys: string[]): void;
