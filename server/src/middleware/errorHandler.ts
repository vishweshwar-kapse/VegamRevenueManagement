import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  errors?: unknown;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;

  console.error(`[Error ${statusCode}] ${err.message}`, err.stack);

  const responseBody: Record<string, unknown> = {
    success: false,
    message: err.message || 'Internal Server Error',
  };
  if (process.env.NODE_ENV === 'development') {
    responseBody.stack = err.stack;
  }
  if (err.errors) {
    responseBody.errors = err.errors;
  }
  res.status(statusCode).json(responseBody);
};

export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
};

export const createError = (message: string, statusCode: number): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
};
