import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify session authentication
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, baseAmount, concession, effectiveFrom } = req.body;

    // 2. Validate payload parameters
    if (!studentId || baseAmount === undefined || !effectiveFrom) {
      return res.status(400).json({ error: 'Missing studentId, baseAmount, or effectiveFrom' });
    }

    // 3. Normalize effectiveFrom to start of month (e.g. '2026-09' or '2026-09-15' -> '2026-09-01')
    const formattedEffectiveFrom = effectiveFrom.length === 7 
      ? `${effectiveFrom}-01` 
      : `${effectiveFrom.slice(0, 7)}-01`;

    // 4. Insert into database using aligned column names
    await sql`
      INSERT INTO student_fee_schedules (
        student_id, 
        base_fee, 
        concession_amount, 
        effective_from_date
      )
      VALUES (
        ${studentId}, 
        ${baseAmount}, 
        ${concession ?? 0}, 
        ${formattedEffectiveFrom}
      );
    `;

    return res.status(200).json({ success: true, studentId });
  } catch (error: any) {
    console.error('Fee Schedule Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}