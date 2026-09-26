import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

const ACADEMIC_MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'] as const;
type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentId, rollNo, monthlyFee, effectiveFromMonth, academicYear } = req.body as {
      studentId?: number;
      rollNo?: string;
      monthlyFee: number;
      effectiveFromMonth: AcademicMonth;
      academicYear: string;
      concession?: number; // ignored - concession is per invoice, not per schedule
    };

    if ((!studentId && !rollNo) || monthlyFee === undefined || !effectiveFromMonth || !academicYear) {
      return res.status(400).json({ error: 'Missing studentId/rollNo, monthlyFee, effectiveFromMonth, or academicYear' });
    }
    if (!ACADEMIC_MONTHS.includes(effectiveFromMonth as any)) {
      return res.status(400).json({ error: `effectiveFromMonth must be one of: ${ACADEMIC_MONTHS.join(', ')}` });
    }

    // Resolve student id
    let dbStudentId: number | null = null;

    if (rollNo) {
      const { rows } = await sql`SELECT id FROM students WHERE roll_no = ${rollNo} AND academic_year = ${academicYear} LIMIT 1;`;
      if (rows.length > 0) dbStudentId = rows[0].id;
    }
    if (!dbStudentId && studentId) {
      const { rows } = await sql`SELECT id FROM students WHERE id = ${Number(studentId)} LIMIT 1;`;
      if (rows.length > 0) dbStudentId = rows[0].id;
    }

    if (!dbStudentId) {
      return res.status(404).json({ error: 'Student not found. Enroll first.' });
    }

    // 1. FIXED: Insert without concession column, with ON CONFLICT
    await sql`
      INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
      VALUES (${dbStudentId}, ${Number(monthlyFee)}, ${effectiveFromMonth}, ${academicYear})
      ON CONFLICT (student_id, academic_year, effective_from_month)
      DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee, updated_at = now();
    `;

    // 2. FIXED: Update all future invoices from effectiveFromMonth onwards
    // Exclude NEW ADMISSION invoices - they must stay 0
    const effectiveIdx = ACADEMIC_MONTHS.indexOf(effectiveFromMonth);
    const monthsToUpdate = ACADEMIC_MONTHS.slice(effectiveIdx);

    for (const month of monthsToUpdate) {
      await sql`
    UPDATE invoices
    SET
      base_fee = ${Number(monthlyFee)},
      net_due = CASE
        WHEN is_waived THEN 0
        ELSE GREATEST(0, ${Number(monthlyFee)} - concession_amount)
      END,
      status = CASE
        WHEN status = 'new_admission' THEN 'new_admission'
        WHEN is_waived THEN status
        WHEN paid_amount >= GREATEST(0, ${Number(monthlyFee)} - concession_amount) AND GREATEST(0, ${Number(monthlyFee)} - concession_amount) > 0 THEN 'paid'
        WHEN paid_amount > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      updated_at = now()
    WHERE student_id = ${dbStudentId} AND academic_year = ${academicYear} AND month = ${month};
  `;
    }

    // 3. Ensure invoices exist for months that may be missing (if student was created before invoices logic)
    for (const month of monthsToUpdate) {
      await sql`
        INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
        SELECT ${dbStudentId}, ${academicYear}, ${month}, ${Number(monthlyFee)}, 0, ${Number(monthlyFee)}, 0, 'unpaid'
        WHERE NOT EXISTS (
          SELECT 1 FROM invoices WHERE student_id = ${dbStudentId} AND academic_year = ${academicYear} AND month = ${month}
        );
      `;
    }

    return res.status(200).json({
      success: true,
      studentId: dbStudentId,
      effectiveFromMonth,
      monthlyFee: Number(monthlyFee),
      updatedMonths: monthsToUpdate
    });

  } catch (error: any) {
    console.error('Fee Schedule Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}