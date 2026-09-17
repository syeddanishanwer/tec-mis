import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from '../_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { studentId, academicYear, month, paidAmount, updatedBy } = req.body;

  try {
    await sql`
      UPDATE invoices
      SET paid_amount = ${paidAmount},
          status = CASE
            WHEN ${paidAmount} >= net_due THEN 'paid'
            WHEN ${paidAmount} > 0 THEN 'partial'
            ELSE 'unpaid'
          END,
          updated_by = ${updatedBy},
          updated_at = now()
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
    `;
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Record Payment Error:', error);
    return res.status(500).json({ error: error.message });
  }
}