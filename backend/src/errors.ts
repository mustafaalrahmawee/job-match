import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Basis aller erwarteten Fehler. Domänen leiten davon ab (z. B. `ConversationNotFoundError`) und
 * legen Status und Code fest; die Fehler-Middleware macht daraus die HTTP-Antwort.
 */
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

/** Form jeder Fehlerantwort, damit das Frontend nur eine Form kennen muss. */
export interface ErrorBody {
  error: { code: string; message: string };
}

/** Unbekannte Route unter /api: JSON statt der HTML-Seite von Express. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'not_found', message: 'Diese Adresse gibt es nicht.' },
  } satisfies ErrorBody);
};

/**
 * Zentrale Fehlerbehandlung. Express 5 leitet auch Fehler aus `async`-Handlern hierher.
 * Unerwartete Fehler gehen ins Log, aber ihr Text nie an den Client – er kann Interna enthalten.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message },
    } satisfies ErrorBody);
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'invalid_request', message: 'Die Anfrage ist ungültig.' },
    } satisfies ErrorBody);
    return;
  }
  req.log.error({ err: error }, 'Unerwarteter Fehler');
  res.status(500).json({
    error: { code: 'internal', message: 'Es ist ein Fehler aufgetreten.' },
  } satisfies ErrorBody);
};
