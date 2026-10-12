import { createApp } from './app.js'
import { env } from './config/env.js'
import { createPrisma } from './shared/prisma.js'

const app = createApp({ prisma: createPrisma(env.DATABASE_URL), tokenTtlDays: env.TOKEN_TTL_DAYS })

app.listen(env.PORT, () => console.log(`job-match backend listening on port ${env.PORT}`))
