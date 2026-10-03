import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(128),
});

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  user: UserSchema,
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
