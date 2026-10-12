import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { env } from '../../config/env.js'
import { createPrisma } from '../../shared/prisma.js'
import { AuthService } from './auth.service.js'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main(): Promise<void> {
  const email = process.argv[2]
  if (process.argv.length !== 3 || !email) fail('usage: pnpm create-user <email>')

  const muted = new Writable({ write: (_chunk, _encoding, callback) => callback() })
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true })
  const lines = rl[Symbol.asyncIterator]()
  const ask = async (question: string) => {
    process.stdout.write(question)
    const next = await lines.next()
    process.stdout.write('\n')
    return next.done ? '' : next.value
  }
  const password = await ask('Password: ')
  if (password.length < 8) fail('password needs at least 8 characters')
  if ((await ask('Repeat password: ')) !== password) fail('passwords do not match')
  rl.close()

  const prisma = createPrisma(env.DATABASE_URL)
  const service = new AuthService(prisma, env.TOKEN_TTL_DAYS)
  try {
    if (await service.getUserByEmail(email)) fail(`${email} already exists`)
    const user = await service.createUser(email, password)
    console.log(`created ${user.email}`)
  } finally {
    await prisma.$disconnect()
  }
}

await main()
