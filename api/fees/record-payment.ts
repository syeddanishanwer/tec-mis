import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, month, academicYear, paidAmount } = req.body;

    if (!studentId || !month || !academicYear || paidAmount === undefined) {
      return res.status(400).json({ error: 'Missing studentId, month, academicYear, or paidAmount' });
    }

    await sql`
      UPDATE invoices
      SET
        paid_amount = ${paidAmount},
        status = CASE
          WHEN ${paidAmount} >= net_due THEN 'paid'
          WHEN ${paidAmount} > 0 THEN 'partial'
          ELSE 'unpaid'
        END,
        updated_at = now()
      WHERE student_id = ${studentId}
        AND month = ${month}
        AND academic_year = ${academicYear};
    `;

    return res.status(200).json({ success: true, studentId, month, academicYear, paidAmount });
  } catch (error: any) {
    console.error('Record Payment Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}