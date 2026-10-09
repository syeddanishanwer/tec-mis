import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT } from 'jose';
import { sql } from '@vercel/postgres';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set.');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method!== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, pin } = req.body || {};

  if (!username ||!pin) {
    return res.status(401).json({ error: 'Username and PIN required' });
  }

  try {
    // 1. Check in new app_users table (your new RBAC)
    const result = await sql`
      SELECT id, username, role FROM app_users
      WHERE username = ${username} AND pin_hash = ${pin}
      LIMIT 1
    `;

    // Handle both Vercel Postgres shapes: result.rows or result array
    const row = (result as any).rows? (result as any).rows[0] : (result as any)[0];

    if (!row) {
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    // 2. Sign JWT with role - this is your audit
    const token = await new SignJWT({
      id: row.id,
      username: row.username,
      role: row.role // owner, principal, cashier, developer
    })
     .setProtectedHeader({ alg: 'HS256' })
     .setIssuedAt()
     .setExpirationTime('7d')
     .sign(JWT_SECRET);

    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    const maxAge = 7 * 24 * 60 * 60;

    const cookieFlags = [
      `auth_token=${token}`,
      `Max-Age=${maxAge}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (isProduction) cookieFlags.push('Secure');

    res.setHeader('Set-Cookie', cookieFlags.join('; '));

    return res.status(200).json({
      success: true,
      user: { id: row.id, username: row.username, role: row.role }
    });

  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}