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
