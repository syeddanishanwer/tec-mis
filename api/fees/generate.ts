import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verify Vercel Cron Header
  const authHeader = req.headers.authorization;
  const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // 2. Verify Manual Admin Login Session
  const isAuthenticatedUser = await verifyAuth(req);

  if (!isCronRequest && !isAuthenticatedUser) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  try {
    // Determine target month (YYYY-MM-01)
    // If request passes a specific month in body, use it; otherwise default to 1st of current/upcoming month
    const targetMonth = req.body?.month || new Date().toISOString().slice(0, 7) + '-01';

    // Insert next month's invoices from active fee schedules
    await sql`
      INSERT INTO invoices (student_id, month_year, base_fee, concession_amount)
      SELECT DISTINCT ON (s.id)
        s.id AS student_id,
        ${targetMonth}::DATE AS month_year,
        fs.base_fee,
        fs.concession_amount
      FROM students s
      JOIN student_fee_schedules fs 
        ON fs.student_id = s.id 
       AND fs.effective_from_date <= ${targetMonth}::DATE
      ORDER BY s.id, fs.effective_from_date DESC
      ON CONFLICT (student_id, month_year) DO NOTHING;
    `;

    return res.status(200).json({ 
      success: true, 
      message: `Invoices generated successfully for ${targetMonth}` 
    });
  } catch (error: any) {
    console.error('Invoice Generation Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}