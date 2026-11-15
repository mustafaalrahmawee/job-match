import { expect, test } from 'vitest'
import { envSchema } from '../../src/config/env.js'

const BASE = { DATABASE_URL: 'postgresql://x' }

function parse(values: Record<string, string>) {
  return envSchema.safeParse({ ...BASE, ...values })
}

test('local addresses over http are fine for ChromaDB, the test ChromaDB and Ollama', () => {
  const result = parse({
    CHROMA_URL: 'http://127.0.0.1:8001',
    TEST_CHROMA_URL: 'http://127.0.0.1:8002',
    OLLAMA_URL: 'http://127.0.0.1:11434',
  })
  expect(result.success).toBe(true)
})

test('the defaults are the local services', () => {
  const result = parse({})
  expect(result.data).toMatchObject({
    CHROMA_URL: 'http://127.0.0.1:8001',
    TEST_CHROMA_URL: '',
    OLLAMA_URL: 'http://127.0.0.1:11434',
  })
})

test('http to any other host stops the start', () => {
  for (const key of ['CHROMA_URL', 'TEST_CHROMA_URL', 'OLLAMA_URL']) {
    expect(parse({ [key]: 'http://service.example.org:8001' }).success).toBe(false)
    expect(parse({ [key]: 'http://localhost:8001' }).success).toBe(false)
  }
})

test('https to another host is fine', () => {
  for (const key of ['CHROMA_URL', 'TEST_CHROMA_URL', 'OLLAMA_URL']) {
    expect(parse({ [key]: 'https://service.example.org' }).success).toBe(true)
  }
})
