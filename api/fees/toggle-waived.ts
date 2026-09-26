import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { studentId, academicYear, month, isWaived } = req.body as {
    studentId: number; academicYear: string; month: string; isWaived: boolean;
  };
  if (!studentId || !academicYear || !month || typeof isWaived !== 'boolean') {
    return res.status(400).json({ error: 'Missing studentId, academicYear, month, or isWaived' });
  }

  try {
    const { rows } = await sql`
      SELECT status, base_fee, concession_amount, paid_amount
      FROM invoices
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month}
      LIMIT 1;
    `;
    if (rows.length === 0) return res.status(404).json({ error: `Invoice not found for ${month} ${academicYear}` });

    const row = rows[0];
    const isNewAdmissionMonth = row.status === 'new_admission';

    if (isWaived) {
      // Waive: forgive what's still due. Payment already recorded (if any) is kept intact,
      // and the underlying status is left untouched — the UI shows "WAIVED" based on the
      // is_waived flag regardless of what status says underneath.
      await sql`
        UPDATE invoices SET is_waived = true, net_due = 0, updated_at = now()
        WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
      `;
    } else {
      // Un-waive: restore net_due. A pre-admission month goes back to 0 (still not billed).
      // A normal month is recomputed from its stored base_fee/concession, then status is
      // re-derived from whatever paid_amount already sits there (never touched by waiving).
      const restoredNetDue = isNewAdmissionMonth
        ? 0
        : Math.max(0, Number(row.base_fee) - Number(row.concession_amount || 0));
      const paidAmount = Number(row.paid_amount || 0);
      const restoredStatus = isNewAdmissionMonth
        ? 'new_admission'
        : paidAmount >= restoredNetDue && restoredNetDue > 0
          ? 'paid'
          : paidAmount > 0
            ? 'partial'
            : 'unpaid';

      await sql`
        UPDATE invoices
        SET is_waived = false, net_due = ${restoredNetDue}, status = ${restoredStatus}, updated_at = now()
        WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
      `;
    }

    return res.status(200).json({ success: true, studentId, month, isWaived });
  } catch (error: any) {
    console.error('Toggle Waived Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}