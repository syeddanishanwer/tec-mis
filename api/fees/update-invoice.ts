import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method!== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentId, academicYear, month, baseFee, concessionAmount } = req.body as {
      studentId: number;
      academicYear: string;
      month: string;
      baseFee: number;
      concessionAmount?: number;
    };

    if (!studentId ||!academicYear ||!month || baseFee === undefined) {
      return res.status(400).json({ error: 'Missing studentId, academicYear, month, or baseFee' });
    }

    // Block edits to NEW ADMISSION or WAIVED invoices
    const { rows: existingRows } = await sql`
      SELECT status, month, is_waived FROM invoices
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month}
      LIMIT 1;
    `;

    if (existingRows.length > 0 && existingRows[0].status === 'new_admission') {
      return res.status(400).json({
        error: `Cannot edit ${month}: This month is marked as NEW ADMISSION (before student joined). Create a fee schedule instead.`,
        status: 'new_admission'
      });
    }

    if (existingRows.length > 0 && existingRows[0].is_waived) {
      return res.status(400).json({
        error: `Cannot edit ${month}: This month is marked WAIVED. Remove the waiver first, then edit the amount.`,
        isWaived: true
      });
    }

    const concession = Number(concessionAmount?? 0);
    const base = Number(baseFee);
    const netDue = Math.max(0, base - concession);

    const result = await sql`
      UPDATE invoices
      SET
        base_fee = ${base},
        concession_amount = ${concession},
        net_due = ${netDue},
        status = CASE
          WHEN paid_amount >= ${netDue} AND ${netDue} > 0 THEN 'paid'
          WHEN paid_amount > 0 THEN 'partial'
          ELSE 'unpaid'
        END,
        updated_at = now()
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month}
      RETURNING id, status, net_due;
    `;

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Invoice not found for ${month} ${academicYear}` });
    }

    return res.status(200).json({
      success: true,
      studentId,
      academicYear,
      month,
      netDue,
      status: result.rows[0].status
    });

  } catch (error: any) {
    console.error('Update Invoice Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}