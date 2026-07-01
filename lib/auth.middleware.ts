import { cookies } from 'next/headers';
import { verifyAccessToken } from './auth/tokens';

export async function authenticateRequest() {
  const cookieStore = cookies();
  const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || 'access_token';
  const token = (await cookieStore).get(ACCESS_COOKIE_NAME)?.value;

  if (!token) return { error: 'Unauthorized: No access token' };

  try {
    const payload = verifyAccessToken(token);

    if (!payload.ok) {
      return {
        error:
          payload.reason === 'expired'
            ? 'Unauthorized: Access token expired'
            : 'Unauthorized: Invalid access token',
      };
    }

    return {
      userId: payload.payload.sub,
      username: payload.payload.username,
      role: payload.payload.role,
    };
  } catch {
    return { error: 'Unauthorized: Invalid or expired token' };
  }
}
