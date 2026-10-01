import crypto from 'node:crypto';

const b64url = (buf: Buffer): string => buf.toString('base64url');

/** Cryptographically random, URL-safe string (state / PKCE verifier). */
export function randomToken(bytes = 32): string {
  return b64url(crypto.randomBytes(bytes));
}

export function codeChallengeS256(verifier: string): string {
  return b64url(crypto.createHash('sha256').update(verifier).digest());
}

/** Constant-time string compare for the OAuth `state` check. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
