import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true });
}