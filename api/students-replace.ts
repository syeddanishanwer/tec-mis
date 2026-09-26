import { sql } from '@vercel/postgres';
import { verifyAuth } from './fees/_auth.js';

const ACADEMIC_MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'] as const;
type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { students, academicYear } = req.body as { students: any[]; academicYear: string };

  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload: students array expected' });
  }
  if (!academicYear) {
    return res.status(400).json({ error: 'Missing required field: academicYear' });
  }

  try {
    // FIXED: Ensure status enum allows new_admission
    await sql`BEGIN`;

    // Allow new_admission status - run once, safe if already exists
    try {
      await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;`;
      await sql`ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('paid','partial','unpaid','new_admission'));`;
    } catch (e) {
      // Ignore if fails (e.g., no permission on first deploy)
      console.log('Status constraint update skipped:', e);
    }

    await sql`DELETE FROM invoices WHERE academic_year = ${academicYear};`;
    await sql`DELETE FROM student_fee_schedules WHERE academic_year = ${academicYear};`;
    await sql`DELETE FROM students WHERE academic_year = ${academicYear};`;

    for (const student of students) {
      const admissionMonth = (student.admissionMonth as AcademicMonth) || 'Jun';
      const admissionIdx = ACADEMIC_MONTHS.indexOf(admissionMonth);

      const minimalData = {
        className: student.className,
        contactNo: student.contactNo,
        admissionMonth,
      };

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
          ${JSON.stringify(minimalData)}::jsonb
        )
        RETURNING id;
      `;
      const studentId = studentResult.rows[0].id;

      const feeChanges: Array<{ newFee: number; effectiveFromMonth: AcademicMonth }> = student.feeChanges || [];
      const baseFee = Number(student.monthlyFee ?? 0);

      if (baseFee > 0) {
        await sql`
          INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
          VALUES (${studentId}, ${baseFee}, 'Jun', ${academicYear})
          ON CONFLICT (student_id, academic_year, effective_from_month) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
        `;
      }

      for (const change of feeChanges) {
        if (change.effectiveFromMonth === 'Jun') continue;
        await sql`
          INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
          VALUES (${studentId}, ${Number(change.newFee)}, ${change.effectiveFromMonth}, ${academicYear})
          ON CONFLICT (student_id, academic_year, effective_from_month) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
        `;
      }

      const feeForMonth = (month: string): number => {
        const monthIdx = ACADEMIC_MONTHS.indexOf(month as AcademicMonth);
        let activeFee = baseFee;
        for (const change of feeChanges) {
          if (ACADEMIC_MONTHS.indexOf(change.effectiveFromMonth) <= monthIdx) {
            activeFee = Number(change.newFee);
          }
        }
        return activeFee;
      };

      for (const month of ACADEMIC_MONTHS) {
        const monthIdx = ACADEMIC_MONTHS.indexOf(month as AcademicMonth);
        const isBeforeAdmission = monthIdx < admissionIdx;
        const expectedFee = feeForMonth(month);
        const concession = Number(student.discount || 0);

        if (isBeforeAdmission) {
          // FIXED: Store expectedFee as base_fee for reference, but net_due=0, status=new_admission
          await sql`
            INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
            VALUES (${studentId}, ${academicYear}, ${month}, ${expectedFee}, 0, 0, 0, 'new_admission');
          `;
        } else {
          const paidAmt = Number(
            student.monthlyAmountsPaid?.[month] ??
            student.monthlyAmounts?.[month] ??
            student.invoices?.find((i: any) => i.month === month)?.paidAmount ??
            0
          );
          const netDue = Math.max(0, expectedFee - concession);
          let status: string = 'unpaid';
          if (paidAmt >= netDue && netDue > 0) status = 'paid';
          else if (paidAmt > 0) status = 'partial';

          await sql`
            INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
            VALUES (${studentId}, ${academicYear}, ${month}, ${expectedFee}, ${concession}, ${netDue}, ${paidAmt}, ${status});
          `;
        }
      }
    }

    await sql`COMMIT`;
    return res.status(200).json({ success: true, count: students.length, academicYear });
  } catch (error: any) {
    await sql`ROLLBACK`;
    console.error('Replace Students Transaction Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}