import { createHmac, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

export const ACCESS_TTL_SECONDS = 600;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string, pepper: Buffer): string {
  return createHmac('sha256', pepper).update(token).digest('hex');
}
