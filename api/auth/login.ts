import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set.');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.body || {};

  if (!pin || pin !== process.env.ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days

  // Construct secure cookie header compatible with Vercel deployment domains
  const cookieFlags = [
    `auth_token=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProduction) {
    cookieFlags.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieFlags.join('; '));

  return res.status(200).json({ success: true });
}