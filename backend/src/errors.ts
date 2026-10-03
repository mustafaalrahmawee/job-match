import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'not_found', 'Diese Adresse gibt es nicht.');
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof AppError) {
    sendError(res, error.status, error.code, error.message);
  } else if (error instanceof ZodError) {
    sendError(res, 400, 'invalid_request', 'Die Anfrage ist ungültig.');
  } else {
    req.log.error({ err: error }, 'Unerwarteter Fehler');
    sendError(res, 500, 'internal', 'Es ist ein Fehler aufgetreten.');
  }
};
