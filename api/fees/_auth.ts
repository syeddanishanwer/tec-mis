import type { VercelRequest } from '@vercel/node';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set.');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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