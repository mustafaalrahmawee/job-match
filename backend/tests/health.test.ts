import request from 'supertest'
import { expect, test } from 'vitest'
import { useTestDatabase } from './helpers.js'

const { app } = useTestDatabase()

test('health checks the database', async () => {
  const response = await request(app).get('/api/v1/health')
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ status: 'ok' })
})
