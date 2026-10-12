import { execSync } from 'node:child_process'
import { env } from '../src/config/env.js'

export default function setup(): void {
  if (!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is missing in backend/.env')
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: env.TEST_DATABASE_URL },
    stdio: 'inherit',
  })
}
