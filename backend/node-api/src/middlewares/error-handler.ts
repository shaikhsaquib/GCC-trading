import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors';
import { logger } from '../core/logger';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Standard API response shape
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  { code: string; message: string };
  meta?:   { requestId: string; timestamp: string };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: { requestId: (res.req as Request).requestId, timestamp: new Date().toISOString() },
  };
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

// ---------------------------------------------------------------------------
// Central error handler — must be the last middleware registered in app.ts
// ---------------------------------------------------------------------------

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Known operational errors
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error:   { code: err.code, message: err.message },
      meta:    { requestId: req.requestId, timestamp: new Date().toISOString() },
    } satisfies ApiResponse);
    return;
  }

  // PostgreSQL unique violation (duplicate key)
  if ((err as NodeJS.ErrnoException).code === '23505') {
    res.status(409).json({
      success: false,
      error:   { code: 'CONFLICT', message: 'Duplicate resource' },
      meta:    { requestId: req.requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // Unknown / programming errors — log full details, hide internals from client
  logger.error('Unhandled error', {
    requestId: req.requestId,
    method:    req.method,
    url:       req.url,
    error:     err.message,
    stack:     err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'An unexpected error occurred',
    },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
  });
}

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error:   { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
