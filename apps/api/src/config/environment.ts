import { z } from 'zod';

const durationPattern = /^\d+(ms|s|m|h|d)$/;

export const environmentSchema = z.object({
  APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z.string().url().refine((value) => value.startsWith('http://') || value.startsWith('https://'), 'must be an HTTP(S) URL'),
  DATABASE_URL: z.string().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'must be a PostgreSQL URL'),
  REDIS_URL: z.string().refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), 'must be a Redis URL'),
  JWT_ACCESS_SECRET: z.string().min(32),
  REFRESH_TOKEN_PEPPER: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().regex(durationPattern).default('10m'),
  REFRESH_TOKEN_TTL: z.string().regex(durationPattern).default('30d'),
  JWT_ISSUER: z.string().min(1).default('ekms-api'),
  JWT_AUDIENCE: z.string().min(1).default('ekms-web'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  ALLOW_MISSING_ORIGIN: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  AI_PROVIDER: z.enum(['fake', 'openai']).default('fake'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default(''),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DICTIONARY_PROVIDER: z.string().min(1).default('fixture'),
  DICTIONARY_API_KEY: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).superRefine((environment, context) => {
  if (environment.AI_PROVIDER === 'openai' && environment.OPENAI_API_KEY.length === 0) {
    context.addIssue({ code: 'custom', path: ['OPENAI_API_KEY'], message: 'is required when AI_PROVIDER=openai' });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Environment validation failed: ${issues}`);
}
