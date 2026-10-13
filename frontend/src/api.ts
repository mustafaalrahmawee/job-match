import { useAuthStore } from './stores/auth'
import type { ApiOptions } from './types'

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API-Fehler ${status}`)
  }
}

export function isAbort(error: unknown): boolean {
  return (error as Error | null)?.name === 'AbortError'
}

export async function fetchApi(path: string, { method = 'GET', body, signal }: ApiOptions = {}): Promise<Response> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {}
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (!response.ok) throw new ApiError(response.status)
  return response
}
