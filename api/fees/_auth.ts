import type { VercelRequest } from '@vercel/node';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set.');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyAuth(req: VercelRequest): Promise<boolean> {
  try {
    const rawCookies = req.headers.cookie;
    if (!rawCookies) return false;

    // Resilient cookie parser handling multiple key-value pairs
    const cookies = rawCookies.split(';').reduce((acc, current) => {
      const [key, ...value] = current.trim().split('=');
      if (key) acc[key] = value.join('=');
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['auth_token'];
    if (!token) return false;

    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}