import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

const ACADEMIC_MONTHS = [
  'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { students, academicYear } = req.body;

  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload: students array expected' });
  }
  if (!academicYear) {
    return res.status(400).json({ error: 'Missing required field: academicYear' });
  }

  try {
    await sql`BEGIN`;

    // Wipe students for this academic year (cascades to student_fee_schedules & invoices)
    await sql`DELETE FROM students WHERE academic_year = ${academicYear};`;

    for (const student of students) {
      // 1. Insert student profile into relational columns
      const studentResult = await sql`
        INSERT INTO students (
          serial_no, roll_no, student_name, father_name,
          class_name, contact_no, contact_no_2, academic_year, admission_date, data
        )
        VALUES (
          ${student.serialNo ?? null}, ${student.rollNo},
          ${student.studentName}, ${student.fatherName}, ${student.className},
          ${student.contactNo ?? null}, ${student.contactNo2 ?? null}, ${academicYear},
          ${student.admissionDate ?? new Date().toISOString().split('T')[0]},
          ${JSON.stringify(student)}::jsonb
        )
        RETURNING id;
      `;
      const studentId = studentResult.rows[0].id;

      // 2. Baseline fee schedule, effective from Jun
      await sql`
        INSERT INTO student_fee_schedules (student_id, monthly_fee, concession, effective_from_month, academic_year)
        VALUES (${studentId}, ${student.monthlyFee ?? 0}, ${student.discount || 0}, 'Jun', ${academicYear});
      `;

      // 3. One schedule row per confirmed fee change (0 to 3 entries, already validated by the parser)
      const feeChanges: Array<{ newFee: number; effectiveFromMonth: string }> = student.feeChanges || [];
      for (const change of feeChanges) {
        await sql`
          INSERT INTO student_fee_schedules (student_id, monthly_fee, concession, effective_from_month, academic_year)
          VALUES (${studentId}, ${change.newFee}, ${student.discount || 0}, ${change.effectiveFromMonth}, ${academicYear});
        `;
      }

      // 4. Build the same "fee active in month X" resolver used by the parser,
      //    so invoices match exactly what the parser used to derive paid status.
      const feeForMonth = (month: string): number => {
        const monthIdx = ACADEMIC_MONTHS.indexOf(month as any);
        let activeFee = student.monthlyFee ?? 0;
        for (const change of feeChanges) {
          if (ACADEMIC_MONTHS.indexOf(change.effectiveFromMonth as any) <= monthIdx) {
            activeFee = change.newFee;
          }
        }
        return activeFee;
      };

      // 5. Populate invoices for Jun through May using the correct month-by-month fee
      for (const month of ACADEMIC_MONTHS) {
        const paidAmt = student.monthlyAmounts?.[month] ?? 0;
        const expectedFee = feeForMonth(month);
        const concession = student.discount || 0;
        const netDue = expectedFee - concession;

        const status = paidAmt >= netDue && netDue > 0 ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

        await sql`
          INSERT INTO invoices (
            student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status
          )
          VALUES (
            ${studentId}, ${academicYear}, ${month}, ${expectedFee}, ${concession}, ${netDue}, ${paidAmt}, ${status}
          );
        `;
      }
    }

    await sql`COMMIT`;
    return res.status(200).json({ success: true, count: students.length });
  } catch (error: any) {
    await sql`ROLLBACK`;
    console.error('Replace Students Transaction Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}