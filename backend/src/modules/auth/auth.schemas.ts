import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
})

export type LoginInput = z.infer<typeof loginSchema>

export const userSchema = z.object({
  id: z.int(),
  email: z.string(),
})

export type UserOutput = z.infer<typeof userSchema>
