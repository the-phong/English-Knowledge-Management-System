import { z } from 'zod';

export const HealthResponseSchema = z.object({
  data: z.object({
    status: z.literal('ok'),
    checks: z.record(z.string(), z.string()).optional(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  timezone: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(100).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthDataSchema = z.object({ accessToken: z.string().min(1), user: UserSchema });
export type AuthData = z.infer<typeof AuthDataSchema>;

export const AuthResponseSchema = z.object({ data: AuthDataSchema });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const AuthSessionSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  current: z.boolean(),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;
