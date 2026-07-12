import type { Request, Response, NextFunction } from 'express';
import { type Logger } from 'pino';
import { type HttpLogger } from 'pino-http';
import { Registry, Counter, Histogram } from 'prom-client';
export type CreateLoggerOptions = {
    service: string;
    level?: string;
};
export declare function createLogger(opts: CreateLoggerOptions): Logger;
export declare function createHttpLogger(logger: Logger): HttpLogger;
export type Metrics = {
    register: Registry;
    httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
    httpRequestDurationMs: Histogram<'method' | 'route' | 'status'>;
    metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
    metricsHandler: (req: Request, res: Response) => Promise<void>;
};
export declare function createMetrics(service: string): Metrics;
export type AppTelemetry = {
    logger: Logger;
    httpMiddleware: (req: Request, res: Response, next: NextFunction) => void;
    metricsHandler: (req: Request, res: Response) => Promise<void>;
    register: Registry;
};
export declare function createAppTelemetry(input: {
    service: string;
}): AppTelemetry;
export declare function createUploadMetrics(register: Registry): {
    recordSuccess: (durationMs: number) => void;
    recordFailure: (durationMs: number) => void;
};
export declare function createDownloadMetrics(register: Registry): {
    recordCompleted: (streamBytes: number) => void;
    recordAborted: () => void;
    recordAnalyticsEnqueueFailure: () => void;
    setUnknownAttempts: (count: number) => void;
};
export declare function createStorageWorkerMetrics(register: Registry): {
    setPending: (count: number) => void;
    recordReclaimed: () => void;
    recordCompleted: () => void;
    recordDeadLetter: () => void;
};
export declare function createAnalyticsWorkerMetrics(register: Registry): {
    recordProcessed: () => void;
    recordRetried: () => void;
    recordFailed: () => void;
    setProjectionLagSeconds: (seconds: number) => void;
    setOldestOutboxAgeSeconds: (seconds: number) => void;
};
export declare function createDependencyReadinessMetrics(register: Registry): {
    setPostgres: (ready: boolean) => void;
    setRedis: (ready: boolean) => void;
    setObjectStore: (ready: boolean) => void;
};
