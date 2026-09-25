import { describe, expect, it } from 'vitest';
import { AuthResponseSchema, HealthResponseSchema, RegisterInputSchema } from './index';

describe('health contract', () => {
  it('accepts the canonical healthy response', () => {
    expect(HealthResponseSchema.parse({ data: { status: 'ok' } })).toEqual({ data: { status: 'ok' } });
  });

  it('rejects an unknown health status', () => {
    expect(() => HealthResponseSchema.parse({ status: 'ready' })).toThrow();
  });
});

describe('auth contracts', () => {
  it('rejects passwords outside the P0 limits', () => {
    expect(() => RegisterInputSchema.parse({ email: 'user@example.test', password: 'short' })).toThrow();
    expect(() => RegisterInputSchema.parse({ email: 'user@example.test', password: 'x'.repeat(129) })).toThrow();
  });

  it('does not define a refresh token in the public auth response', () => {
    const parsed = AuthResponseSchema.parse({
      data: {
        accessToken: 'jwt',
        user: { id: '13ce13ac-0ff1-4d20-8818-742499aac6ef', email: 'user@example.test', displayName: null, timezone: 'Asia/Bangkok' },
      },
    });
    expect(parsed.data).not.toHaveProperty('refreshToken');
  });
});
