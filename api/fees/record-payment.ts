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

    const numericAmount = Number(paidAmount);

    // 1. Update the invoices table
    await sql`
      UPDATE invoices
      SET
        paid_amount = ${numericAmount},
        status = CASE
          WHEN ${numericAmount} >= net_due THEN 'paid'
          WHEN ${numericAmount} > 0 THEN 'partial'
          ELSE 'unpaid'
        END,
        updated_at = now()
      WHERE student_id = ${studentId}
        AND month = ${month}
        AND academic_year = ${academicYear};
    `;

    // 2. Keep the student's data JSON column in sync as well
    const studentQuery = await sql`SELECT data FROM students WHERE id = ${studentId};`;
    if (studentQuery.rows.length > 0) {
      const studentData = studentQuery.rows[0].data || {};

      const derivedStatus =
        numericAmount > 0
          ? numericAmount >= (studentData.monthlyFee || 0)
            ? 'paid'
            : 'partial'
          : 'unpaid';

      // Update root-level maps
      studentData.monthlyAmountsPaid = {
        ...(studentData.monthlyAmountsPaid || {}),
        [month]: numericAmount,
      };
      studentData.monthlyStatus = {
        ...(studentData.monthlyStatus || {}),
        [month]: derivedStatus,
      };

      // Update yearly session-nested maps
      if (!studentData.yearlyAmountsPaid) studentData.yearlyAmountsPaid = {};
      if (!studentData.yearlyAmountsPaid[academicYear]) studentData.yearlyAmountsPaid[academicYear] = {};
      studentData.yearlyAmountsPaid[academicYear][month] = numericAmount;

      if (!studentData.yearlyStatus) studentData.yearlyStatus = {};
      if (!studentData.yearlyStatus[academicYear]) studentData.yearlyStatus[academicYear] = {};
      studentData.yearlyStatus[academicYear][month] = derivedStatus;

      await sql`
        UPDATE students
        SET
          data = ${JSON.stringify(studentData)}::jsonb,
          updated_at = now()
        WHERE id = ${studentId};
      `;
    }

    return res.status(200).json({ success: true, studentId, month, academicYear, paidAmount: numericAmount });
  } catch (error: any) {
    console.error('Record Payment Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}