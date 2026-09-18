import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentId, academicYear, month, baseFee, concessionAmount } = req.body;

    if (!studentId || !academicYear || !month || baseFee === undefined) {
      return res.status(400).json({ error: 'Missing studentId, academicYear, month, or baseFee' });
    }

    const concession = concessionAmount ?? 0;
    const netDue = Number(baseFee) - Number(concession);

    await sql`
      UPDATE invoices
      SET
        base_fee = ${baseFee},
        concession_amount = ${concession},
        net_due = ${netDue},
        status = CASE
          WHEN paid_amount >= ${netDue} THEN 'paid'
          WHEN paid_amount > 0 THEN 'partial'
          ELSE 'unpaid'
        END,
        updated_at = now()
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
    `;

    return res.status(200).json({ success: true, studentId, academicYear, month });
  } catch (error: any) {
    console.error('Update Invoice Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}