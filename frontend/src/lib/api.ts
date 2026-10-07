import { ErrorResponseSchema } from '@job-match/shared';
import type { z } from 'zod';

const TOKEN_KEY = 'job-match.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined): void {
  onUnauthorized = handler;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function toApiError(response: Response, hadToken: boolean): Promise<ApiError> {
  if (response.status === 401 && hadToken) {
    clearToken();
    onUnauthorized?.();
  }
  const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => undefined));
  return new ApiError(
    response.status,
    parsed.success ? parsed.data.error.message : 'Es ist ein Fehler aufgetreten.',
  );
}

interface SendOptions {
  readonly body?: BodyInit;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
}

async function send(method: string, path: string, options: SendOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(),
    ...options.headers,
  };
  if (options.contentType) headers['Content-Type'] = options.contentType;
  const response = await fetch(path, { method, headers, body: options.body });
  if (!response.ok) throw await toApiError(response, 'Authorization' in headers);
  return response;
}

async function parseJson<T>(response: Response, path: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) throw new ApiError(response.status, `Unerwartete Antwort von ${path}`);
  return parsed.data;
}

export async function apiJson<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const response = await send(
    method,
    path,
    body === undefined ? {} : { body: JSON.stringify(body), contentType: 'application/json' },
  );
  return parseJson(response, path, schema);
}

export async function apiUpload<T>(path: string, file: File, schema: z.ZodType<T>): Promise<T> {
  const response = await send('POST', path, {
    body: file,
    contentType: file.type,
    headers: { 'X-File-Name': encodeURIComponent(file.name) },
  });
  return parseJson(response, path, schema);
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await send('GET', path)).blob();
}

export async function apiVoid(
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<void> {
  await send(
    method,
    path,
    body === undefined ? {} : { body: JSON.stringify(body), contentType: 'application/json' },
  );
}
