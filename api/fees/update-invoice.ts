import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentId, monthYear, baseFee, concessionAmount } = req.body;

    if (!studentId || !monthYear || baseFee === undefined) {
      return res.status(400).json({ error: 'Missing studentId, monthYear, or baseFee' });
    }

    const formattedMonth = monthYear.length === 7 ? `${monthYear}-01` : monthYear;

    // Direct update to an already existing past invoice
    await sql`
      UPDATE invoices
      SET 
        base_fee = ${baseFee},
        concession_amount = ${concessionAmount ?? 0}
      WHERE student_id = ${studentId} AND month_year = ${formattedMonth}::DATE;
    `;

    return res.status(200).json({ success: true, studentId, monthYear: formattedMonth });
  } catch (error: any) {
    console.error('Update Invoice Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}