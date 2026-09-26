import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

const ACADEMIC_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
const monthToNum: Record<string, number> = { Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11, Jan:0, Feb:1, Mar:2, Apr:3, May:4 };

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

  const { action } = req.body as { action: 'updateFee' | 'toggleWaived' | 'updateAdmission' };
  if (!action) return res.status(400).json({ error: 'Missing required field: action' });

  try {
    if (action === 'updateFee') return await handleUpdateFee(req, res);
    if (action === 'toggleWaived') return await handleToggleWaived(req, res);
    if (action === 'updateAdmission') return await handleUpdateAdmission(req, res);
    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('Invoice Actions Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ---- action: 'updateFee' (was api/fees/update-invoice.ts) ----
async function handleUpdateFee(req: any, res: any) {
  const { studentId, academicYear, month, baseFee, concessionAmount } = req.body as {
    studentId: number; academicYear: string; month: string; baseFee: number; concessionAmount?: number;
  };
  if (!studentId || !academicYear || !month || baseFee === undefined) {
    return res.status(400).json({ error: 'Missing studentId, academicYear, month, or baseFee' });
  }

  const { rows: existingRows } = await sql`
    SELECT status, is_waived FROM invoices
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

  const concession = Number(concessionAmount ?? 0);
  const base = Number(baseFee);
  const netDue = Math.max(0, base - concession);

  const result = await sql`
    UPDATE invoices
    SET base_fee = ${base}, concession_amount = ${concession}, net_due = ${netDue},
      status = CASE
        WHEN paid_amount >= ${netDue} AND ${netDue} > 0 THEN 'paid'
        WHEN paid_amount > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      updated_at = now()
    WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month}
    RETURNING id, status, net_due;
  `;
  if (result.rowCount === 0) return res.status(404).json({ error: `Invoice not found for ${month} ${academicYear}` });

  return res.status(200).json({ success: true, studentId, academicYear, month, netDue, status: result.rows[0].status });
}

// ---- action: 'toggleWaived' (was api/fees/toggle-waived.ts) ----
async function handleToggleWaived(req: any, res: any) {
  const { studentId, academicYear, month, isWaived } = req.body as {
    studentId: number; academicYear: string; month: string; isWaived: boolean;
  };
  if (!studentId || !academicYear || !month || typeof isWaived !== 'boolean') {
    return res.status(400).json({ error: 'Missing studentId, academicYear, month, or isWaived' });
  }

  const { rows } = await sql`
    SELECT status, base_fee, concession_amount, paid_amount
    FROM invoices WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month}
    LIMIT 1;
  `;
  if (rows.length === 0) return res.status(404).json({ error: `Invoice not found for ${month} ${academicYear}` });

  const row = rows[0];
  const isNewAdmissionMonth = row.status === 'new_admission';

  if (isWaived) {
    await sql`
      UPDATE invoices SET is_waived = true, net_due = 0, updated_at = now()
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
    `;
  } else {
    const restoredNetDue = isNewAdmissionMonth ? 0 : Math.max(0, Number(row.base_fee) - Number(row.concession_amount || 0));
    const paidAmount = Number(row.paid_amount || 0);
    const restoredStatus = isNewAdmissionMonth ? 'new_admission'
      : paidAmount >= restoredNetDue && restoredNetDue > 0 ? 'paid'
      : paidAmount > 0 ? 'partial' : 'unpaid';

    await sql`
      UPDATE invoices SET is_waived = false, net_due = ${restoredNetDue}, status = ${restoredStatus}, updated_at = now()
      WHERE student_id = ${studentId} AND academic_year = ${academicYear} AND month = ${month};
    `;
  }

  return res.status(200).json({ success: true, studentId, month, isWaived });
}

// ---- action: 'updateAdmission' (was api/fees/update-admission.ts) ----
async function handleUpdateAdmission(req: any, res: any) {
  const { studentId, academicYear, newAdmissionMonth } = req.body as {
    studentId: number; academicYear: string; newAdmissionMonth: string;
  };
  const newIdx = ACADEMIC_MONTHS.indexOf(newAdmissionMonth);
  if (!studentId || !academicYear || newIdx === -1) {
    return res.status(400).json({ error: 'Missing or invalid studentId, academicYear, or newAdmissionMonth' });
  }

  await sql`BEGIN`;
  try {
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
            error: `Cannot mark ${row.month} as pre-admission: Rs. ${row.paid_amount} already recorded as paid. Clear that payment first.`
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
    }

    const admissionDate = computeAdmissionDate(academicYear, newAdmissionMonth);
    await sql`
      UPDATE students SET admission_date = ${admissionDate}, updated_at = now()
      WHERE id = ${studentId};
    `;

    await sql`COMMIT`;
    return res.status(200).json({ success: true, studentId, newAdmissionMonth, admissionDate });
  } catch (err) {
    await sql`ROLLBACK`;
    throw err;
  }
}