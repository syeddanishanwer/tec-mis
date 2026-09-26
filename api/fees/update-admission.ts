import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

const ACADEMIC_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];

// Same mapping used in src/utils/importHelpers.ts — kept identical on purpose,
// so a manual admission-month edit always resolves to the same calendar date
// an Excel import would have produced for the same (academicYear, month).
const monthToNum: Record<string, number> = {
  Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4,
};

function computeAdmissionDate(academicYear: string, admissionMonth: string): string {
  const yearStart = parseInt(academicYear.split('-')[0], 10);
  const jsMonth = monthToNum[admissionMonth];
  const admYear = jsMonth >= 5 ? yearStart : yearStart + 1;
  return `${admYear}-${String(jsMonth + 1).padStart(2, '0')}-01`;
}

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { studentId, academicYear, newAdmissionMonth } = req.body as {
    studentId: number; academicYear: string; newAdmissionMonth: string;
  };
  const newIdx = ACADEMIC_MONTHS.indexOf(newAdmissionMonth);
  if (!studentId || !academicYear || newIdx === -1) {
    return res.status(400).json({ error: 'Missing or invalid studentId, academicYear, or newAdmissionMonth' });
  }

  try {
    await sql`BEGIN`;

    const { rows } = await sql`
      SELECT month, status, paid_amount, base_fee, concession_amount
      FROM invoices WHERE student_id = ${studentId} AND academic_year = ${academicYear};
    `;

    if (rows.length === 0) {
      await sql`ROLLBACK`;
      return res.status(404).json({ error: `No invoices found for student ${studentId} in ${academicYear}` });
    }

    for (const row of rows) {
      const idx = ACADEMIC_MONTHS.indexOf(row.month);
      const shouldBeNewAdmission = idx < newIdx;
      const currentlyNewAdmission = row.status === 'new_admission';

      if (shouldBeNewAdmission && !currentlyNewAdmission) {
        if (Number(row.paid_amount) > 0) {
          await sql`ROLLBACK`;
          return res.status(409).json({
            error: `Cannot mark ${row.month} as pre-admission: Rs. ${row.paid_amount} already recorded as paid. Clear that payment first.`,
          });
        }
        await sql`
          UPDATE invoices SET status = 'new_admission', net_due = 0, paid_amount = 0, updated_at = now()
          WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${row.month};
        `;
      } else if (!shouldBeNewAdmission && currentlyNewAdmission) {
        const netDue = Math.max(0, Number(row.base_fee) - Number(row.concession_amount || 0));
        await sql`
          UPDATE invoices SET status = 'unpaid', net_due = ${netDue}, paid_amount = 0, updated_at = now()
          WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${row.month};
        `;
      }
      // Months where shouldBeNewAdmission === currentlyNewAdmission are left untouched entirely.
    }

    const admissionDate = computeAdmissionDate(academicYear, newAdmissionMonth);
    await sql`
      UPDATE students SET admission_date = ${admissionDate}, updated_at = now()
      WHERE id = ${studentId};
    `;

    await sql`COMMIT`;
    return res.status(200).json({ success: true, studentId, newAdmissionMonth, admissionDate });
  } catch (error: any) {
    await sql`ROLLBACK`;
    console.error('Update Admission Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}