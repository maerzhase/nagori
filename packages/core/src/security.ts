const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

export function randomId(prefix: string): string {
  return `${prefix}_${randomToken(12)}`;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      // Workers' Web Crypto rejects anything above 100000 outright, so this is
      // the ceiling rather than a tuned value. Changing it invalidates every
      // stored hash: the parameters are implicit, not recorded per user.
      iterations: 100_000,
    },
    key,
    256,
  );
  return { salt, hash: bytesToHex(new Uint8Array(bits)) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
) {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < hash.length; index += 1) {
    difference |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Minimum length only. Composition rules and maximums do more harm than good. */
export const MINIMUM_PASSWORD_LENGTH = 8;

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH;
}
