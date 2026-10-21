import { z } from 'zod';

const url = z.url();
const port = z.coerce.number().int().min(1).max(65535);
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

export const apiEnvSchema = common.extend({ API_PORT: port.default(3001) });
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
