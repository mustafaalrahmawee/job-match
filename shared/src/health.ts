import { z } from 'zod';

/** Antwort von `GET /api/health` – bei 200 und bei 503 dieselbe Form. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['ok', 'error']),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
