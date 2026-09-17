import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, baseAmount, concession, effectiveFrom } = req.body;

    if (!studentId || baseAmount === undefined || !effectiveFrom) {
      return res.status(400).json({ error: 'Missing studentId, baseAmount, or effectiveFrom' });
    }

    await sql`
      INSERT INTO student_fee_schedules (student_id, base_amount, concession, effective_from)
      VALUES (${studentId}, ${baseAmount}, ${concession ?? 0}, ${effectiveFrom});
    `;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Fee Schedule Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}