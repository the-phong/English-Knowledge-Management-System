import { refreshCookieOptions } from '../src/auth/auth.controller';
import { classifyRefreshSession } from '../src/auth/auth.service';
import { durationToMilliseconds } from '../src/auth/token.service';

describe('auth policy helpers', () => {
  it.each([
    ['10m', 600_000],
    ['30d', 2_592_000_000],
    ['500ms', 500],
  ])('parses duration %s', (value, expected) => {
    expect(durationToMilliseconds(value)).toBe(expected);
  });

  it('uses secure production refresh-cookie flags', () => {
    expect(refreshCookieOptions('production', 1_000)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 1_000,
    });
  });

  it.each([
    [{ expires_at: new Date('2030-01-02'), revoked_at: null, replaced_by_id: null }, 'rotate'],
    [{ expires_at: new Date('2029-12-31'), revoked_at: null, replaced_by_id: null }, 'invalid'],
    [{ expires_at: new Date('2030-01-02'), revoked_at: new Date('2030-01-01'), replaced_by_id: null }, 'reuse'],
    [{ expires_at: new Date('2030-01-02'), revoked_at: null, replaced_by_id: 'replacement-id' }, 'reuse'],
  ] as const)('classifies refresh-session lifecycle %#', (session, expected) => {
    expect(classifyRefreshSession(session, new Date('2030-01-01'))).toBe(expected);
  });
});
