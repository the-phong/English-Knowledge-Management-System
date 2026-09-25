import { validateEnvironment } from '../src/config/environment';

const validEnvironment = {
  APP_ENV: 'test',
  API_PORT: '3001',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://ekms:password@localhost:5432/ekms',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_PEPPER: 'b'.repeat(32),
  ACCESS_TOKEN_TTL: '10m',
  REFRESH_TOKEN_TTL: '30d',
  AI_PROVIDER: 'fake',
  DICTIONARY_PROVIDER: 'fixture',
};

describe('environment validation', () => {
  it('parses a valid local/test environment', () => {
    expect(validateEnvironment(validEnvironment).API_PORT).toBe(3001);
  });

  it('fails fast when a required secret is too short', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: 'short' }))
      .toThrow('Environment validation failed: JWT_ACCESS_SECRET');
  });

  it('requires an API key only for the OpenAI provider', () => {
    expect(() => validateEnvironment({ ...validEnvironment, AI_PROVIDER: 'openai', OPENAI_API_KEY: '' }))
      .toThrow('OPENAI_API_KEY');
  });
});
