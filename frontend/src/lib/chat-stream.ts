import { ChatEventSchema } from '@job-match/shared';
import type { ChatEvent, ChatRequest } from '@job-match/shared';

import { ApiError, authHeaders, toApiError } from './api';

function parseEvent(frame: string): ChatEvent | undefined {
  const data = /^data: (.*)$/m.exec(frame)?.[1];
  if (data === undefined) return undefined;
  const event = ChatEventSchema.safeParse(JSON.parse(data));
  if (!event.success) throw new ApiError(200, 'Unerwartetes Ereignis im Chat-Stream.');
  return event.data;
}

export async function* streamChat(
  request: ChatRequest,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const headers = { 'Content-Type': 'application/json', ...authHeaders() };
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw await toApiError(response, 'Authorization' in headers);
  if (!response.body)
    throw new ApiError(response.status, 'Der Server hat keinen Stream geliefert.');

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const event = parseEvent(frame);
      if (event) yield event;
    }
  }
}
