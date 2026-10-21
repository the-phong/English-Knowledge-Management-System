import { z } from 'zod';

const url = z.url();
const port = z.coerce.number().int().min(1).max(65535);
const key = z.string().refine((value) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length >= 32 && bytes.toString('base64') === value;
}, 'Canonical base64 secret of at least 32 bytes required');
const origins = z.string().transform((value, context) => {
  const entries = value.split(',').map((entry) => entry.trim());
  if (
    entries.length === 0 ||
    entries.some((entry) => {
      try {
        const parsed = new URL(entry);
        return (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== entry
        );
      } catch {
        return true;
      }
    }) ||
    new Set(entries).size !== entries.length
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Exact comma-separated origins required',
    });
    return z.NEVER;
  }
  return entries;
});
const limit = z.coerce.number().int().min(1).max(1000);
const common = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: url.refine(
    (value) => value.startsWith('postgresql://'),
    'PostgreSQL URL required',
  ),
  REDIS_URL: url.refine(
    (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
    'Redis URL required',
  ),
});

export const apiEnvSchema = common
  .extend({
    API_PORT: port.default(3001),
    JWT_SIGNING_KEY_B64: key,
    REFRESH_PEPPER_B64: key,
    JWT_ISSUER: z.string().min(1).max(200),
    JWT_AUDIENCE: z.string().min(1).max(200),
    AUTH_ALLOWED_ORIGINS: origins,
    AUTH_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true'),
    AUTH_LOGIN_IP_LIMIT: limit.default(20),
    AUTH_LOGIN_ACCOUNT_LIMIT: limit.default(5),
    AUTH_REGISTER_IP_LIMIT: limit.default(5),
    AUTH_REFRESH_IP_LIMIT: limit.default(30),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && !value.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'Secure cookies required in production',
      });
    }
    if (
      value.NODE_ENV === 'production' &&
      value.AUTH_ALLOWED_ORIGINS.some(
        (origin) => !origin.startsWith('https://'),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_ALLOWED_ORIGINS'],
        message: 'HTTPS origins required in production',
      });
    }
    if (value.JWT_SIGNING_KEY_B64 === value.REFRESH_PEPPER_B64) {
      context.addIssue({
        code: 'custom',
        path: ['REFRESH_PEPPER_B64'],
        message: 'Separate cryptographic keys required',
      });
    }
  });
export const workerEnvSchema = common;
export const webEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_INTERNAL_URL: url,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseApiEnv(source: NodeJS.ProcessEnv): ApiEnv {
  return apiEnvSchema.parse(source);
}

export function parseWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return workerEnvSchema.parse(source);
}

export function parseWebEnv(source: NodeJS.ProcessEnv): WebEnv {
  return webEnvSchema.parse(source);
}
