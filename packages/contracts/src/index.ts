import { z } from 'zod';

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
