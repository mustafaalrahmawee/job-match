import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Not authenticated') {
    super(401, message)
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({ detail: error.issues })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(422).json({ detail: 'Invalid JSON body' })
    return
  }
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ detail: 'The request body is too large' })
    return
  }
  if (error instanceof UnauthorizedError) {
    res.status(401).set('WWW-Authenticate', 'Bearer').json({ detail: error.message })
    return
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ detail: error.message })
    return
  }
  console.error(error)
  res.status(500).json({ detail: 'Internal server error' })
}
