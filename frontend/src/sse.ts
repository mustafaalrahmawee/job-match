import type { SseHandler } from './types'

export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: SseHandler): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    let end = buffer.indexOf('\n\n')
    while (end >= 0) {
      dispatch(buffer.slice(0, end), onEvent)
      buffer = buffer.slice(end + 2)
      end = buffer.indexOf('\n\n')
    }
  }
}

function dispatch(chunk: string, onEvent: SseHandler) {
  let event = 'message'
  let data = ''
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7)
    else if (line.startsWith('data: ')) data += line.slice(6)
  }
  if (data) onEvent(event, JSON.parse(data))
}
