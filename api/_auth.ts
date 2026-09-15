import type { VercelRequest } from '@vercel/node';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_key_must_be_long_enough'
);

export async function verifyAuth(req: VercelRequest): Promise<boolean> {
  try {
    const cookies = req.headers.cookie || '';
    const match = cookies.split('; ').find((row) => row.startsWith('auth_token='));
    if (!match) return false;

    const token = match.split('=')[1];
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}