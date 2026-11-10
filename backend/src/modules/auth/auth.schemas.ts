import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
})

export const userSchema = z.object({
  id: z.int(),
  email: z.string(),
})
