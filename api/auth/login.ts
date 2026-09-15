import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_key_must_be_long_enough'
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pin } = req.body;

  // Simple local PIN check (or query your database for password check)
  if (pin !== process.env.ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Generate lightweight JWT valid for 7 days
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  // Set HTTP-Only Cookie
  res.setHeader(
    'Set-Cookie',
    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  );

  return res.status(200).json({ success: true });
}