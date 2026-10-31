export interface JwtClaims {
  sub?: string;
  session_id?: string;
  exp?: number;
  amr?: Array<{ method: string; timestamp: number }>;
}

/**
 * Decode (NOT verify) a JWT payload. Only call this on tokens that Supabase
 * Auth has already verified via auth.getUser().
 */
export function decodeJwtClaims(token: string): JwtClaims {
  const payload = token.split('.')[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtClaims;
  } catch {
    return {};
  }
}
