import type { z } from 'zod';

/** Die Antwort passt nicht zum erwarteten Schema – z. B. weil Backend und Frontend auseinanderlaufen. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Holt JSON vom Backend und prüft es mit dem Zod-Schema aus `@job-match/shared` – demselben, das
 * das Backend benutzt. Relative Pfade: Im Dev-Server leitet der Proxy /api an das Backend weiter.
 *
 * Geprüft wird der Körper, nicht der Status: Manche Routen antworten auch im Fehlerfall mit
 * derselben Form (z. B. Health mit 503). Netzwerkfehler wirft `fetch` selbst.
 */
export async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, `Unerwartete Antwort von ${path}`);
  }
  return parsed.data;
}
