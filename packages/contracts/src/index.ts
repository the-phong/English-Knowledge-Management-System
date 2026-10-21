import { z } from 'zod';
export * from './vocabulary';

export const healthSchema = z.object({ status: z.literal('ok') });
export const readinessSchema = z.object({ status: z.literal('ready') });
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().uuid(),
  }),
});

export type ApiSuccess<T> = { data: T };
export type ApiError = z.infer<typeof errorEnvelopeSchema>;

export const accountUserSchema = z.object({
  id: z.string().uuid(),
  email: z.email().max(254),
  timezone: z.string(),
  preferences: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});
export const loginResultSchema = z.object({
  accessToken: z.string(),
  user: accountUserSchema,
});
export const refreshResultSchema = z.object({ accessToken: z.string() });
export type AccountUser = z.infer<typeof accountUserSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
