import { z } from 'zod';

export * from './auth';
export * from './chat';

export const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
