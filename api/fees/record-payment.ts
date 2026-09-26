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
    const { studentId, month, academicYear, paidAmount } = req.body || {};

    // Validation
    if (!studentId || !month || !academicYear || paidAmount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: studentId, month, academicYear, paidAmount'
      });
    }

    const numericAmount = Number(paidAmount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'paidAmount must be a valid number >= 0' });
    }

    // 1. Fetch current invoice to check status, net_due, and is_waived flag
    const invoiceRes = await sql`
      SELECT id, net_due, base_fee, status, COALESCE(is_waived, false) AS is_waived
      FROM invoices
      WHERE student_id = ${Number(studentId)}
        AND month = ${month}
        AND academic_year = ${academicYear}
      LIMIT 1;
    `;

    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({
        error: `Invoice not found for student ${studentId}, month ${month}, year ${academicYear}. Run Generate Invoices first.`
      });
    }

    const currentInvoice = invoiceRes.rows[0];

    // Prevent payment on NEW_ADMISSION months
    if (currentInvoice.status === 'new_admission') {
      return res.status(400).json({
        error: `Cannot record payment for ${month}: Student has NEW ADMISSION status (joined after this month)`
      });
    }

    // WAIVER GUARD: Prevent recording payment on WAIVED months
    if (currentInvoice.is_waived) {
      return res.status(400).json({
        error: `Cannot edit ${month}: This month is marked WAIVED. Remove the waiver first.`,
        isWaived: true
      });
    }

    const netDue = Number(currentInvoice.net_due);

    // 2. Calculate new status based on paid amount vs net_due
    let newStatus: 'paid' | 'partial' | 'unpaid';
    if (numericAmount >= netDue && netDue > 0) {
      newStatus = 'paid';
    } else if (numericAmount > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'unpaid';
    }

    // 3. Update ONLY invoices table - Single source of truth
    const updateRes = await sql`
      UPDATE invoices
      SET
        paid_amount = ${numericAmount},
        status = ${newStatus},
        updated_at = now()
      WHERE student_id = ${Number(studentId)}
        AND month = ${month}
        AND academic_year = ${academicYear}
      RETURNING
        id, student_id, academic_year, month, base_fee,
        concession_amount, net_due, paid_amount, status,
        COALESCE(is_waived, false) AS is_waived;
    `;

    const updatedInvoice = updateRes.rows[0];

    // 4. Return updated invoice for instant UI update
    return res.status(200).json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        studentId: updatedInvoice.student_id,
        academicYear: updatedInvoice.academic_year,
        month: updatedInvoice.month,
        baseFee: Number(updatedInvoice.base_fee),
        concessionAmount: Number(updatedInvoice.concession_amount),
        netDue: Number(updatedInvoice.net_due),
        paidAmount: Number(updatedInvoice.paid_amount),
        status: updatedInvoice.status,
        isWaived: Boolean(updatedInvoice.is_waived)
      },
      message: `Payment updated: ${month} is now ${newStatus} (Rs. ${numericAmount})`
    });

  } catch (error: any) {
    console.error('Record Payment Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}