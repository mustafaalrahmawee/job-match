export type User = { id: number; email: string }

export type HealthStatus = 'unknown' | 'ok' | 'error'

export type ApiOptions = { method?: string; body?: unknown; signal?: AbortSignal }

export type SseHandler = (event: string, data: unknown) => void

export type Role = 'user' | 'assistant'

export type ApiMessage = { id: number; role: Role; text: string; stop_reason: string | null }

export type Conversation = { id: number; title: string; messages: ApiMessage[] }

export type ConversationSummary = { id: number; title: string }

export type Quality = 'normal' | 'extended'

export type Effort = 'medium' | 'high'

export type Delta = { text: string }

export type Done = { message: ApiMessage | null; stop_reason: string }

export type ChatMessage = { key: string; role: Role; text: string; stopReason: string | null }
