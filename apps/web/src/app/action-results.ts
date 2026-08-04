/**
 * Shapes returned by the actions that reveal a secret once. They live outside
 * actions.ts because a "use server" module may only export async functions.
 */

export interface PairingResult {
  name?: string;
  code?: string;
  codeExpiresAt?: string;
  link?: string;
  linkExpiresAt?: string;
  error?: string;
}

export interface InviteResult {
  email?: string;
  link?: string;
  error?: string;
}
