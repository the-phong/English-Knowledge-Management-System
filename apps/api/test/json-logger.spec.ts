import { JsonLogger } from '../src/common/logging/json.logger';

describe('JsonLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('redacts sensitive keys and configured secret values', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new JsonLogger(['known-secret-value']);

    logger.log({ password: 'plain-password', note: 'contains known-secret-value' }, 'test');

    const line = String(output.mock.calls[0]?.[0]);
    expect(line).not.toContain('plain-password');
    expect(line).not.toContain('known-secret-value');
    expect(line).toContain('[REDACTED]');
  });
});
