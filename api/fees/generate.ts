import { sql } from '@vercel/postgres';
import { verifyAuth } from './_auth.js';

const ACADEMIC_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'] as const;
type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAuthenticatedUser = await verifyAuth(req);

  if (!isCronRequest &&!isAuthenticatedUser) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method!== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month: targetMonth, academicYear } = req.body as { month: AcademicMonth; academicYear: string } || {} as any;

    if (!targetMonth ||!academicYear) {
      return res.status(400).json({ error: 'Missing required fields: month and academicYear' });
    }

    const targetMonthIndex = ACADEMIC_MONTHS.indexOf(targetMonth);
    if (targetMonthIndex === -1) {
      return res.status(400).json({ error: `Invalid target month: ${targetMonth}` });
    }

    // FIXED: Get admission_date to calculate NEW ADMISSION
    const { rows: students } = await sql`
      SELECT id, admission_date FROM students WHERE academic_year = ${academicYear};
    `;

    // FIXED: No concession column in fee_schedules
    const { rows: schedules } = await sql`
      SELECT id, student_id, monthly_fee, effective_from_month
      FROM student_fee_schedules
      WHERE academic_year = ${academicYear};
    `;

    const scheduleMap = new Map<number, typeof schedules>();
    schedules.forEach((sched) => {
      if (!scheduleMap.has(sched.student_id)) {
        scheduleMap.set(sched.student_id, []);
      }
      scheduleMap.get(sched.student_id)!.push(sched);
    });

    let generatedCount = 0;
    let newAdmissionCount = 0;

    for (const student of students) {
      // Determine admission month from admission_date
      let admissionIdx = 0; // Default Jun
      if (student.admission_date) {
        const admDate = new Date(student.admission_date);
        const monthNum = admDate.getMonth(); // 0-11
        // Map JS month to academic month
        // Jun=5, Jul=6, Aug=7, Sep=8, Oct=9, Nov=10, Dec=11, Jan=0, Feb=1, Mar=2, Apr=3, May=4
        const jsToAcademic: Record<number, AcademicMonth> = {
          5: 'Jun', 6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec',
          0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May'
        };
        const admAcademicMonth = jsToAcademic[monthNum] as AcademicMonth | undefined;
        if (admAcademicMonth) {
          admissionIdx = ACADEMIC_MONTHS.indexOf(admAcademicMonth);
        }
      }

      const isBeforeAdmission = targetMonthIndex < admissionIdx;

      if (isBeforeAdmission) {
        // FIXED: Generate NEW ADMISSION invoice with 0 due
        const result = await sql`
          INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
          VALUES (${student.id}, ${academicYear}, ${targetMonth}, 0, 0, 0, 0, 'new_admission')
          ON CONFLICT (student_id, academic_year, month) DO UPDATE SET
            base_fee = 0,
            concession_amount = 0,
            net_due = 0,
            status = 'new_admission',
            updated_at = now()
          RETURNING student_id;
        `;
        if (result.rows.length > 0) newAdmissionCount++;
        continue;
      }

      const studentSchedules = scheduleMap.get(student.id) || [];

      const applicableSchedules = studentSchedules.filter((sched) => {
        const schedMonthIndex = ACADEMIC_MONTHS.indexOf(sched.effective_from_month as AcademicMonth);
        return schedMonthIndex!== -1 && schedMonthIndex <= targetMonthIndex;
      });

      applicableSchedules.sort((a, b) => {
        const idxA = ACADEMIC_MONTHS.indexOf(a.effective_from_month as AcademicMonth);
        const idxB = ACADEMIC_MONTHS.indexOf(b.effective_from_month as AcademicMonth);
        return idxB - idxA;
      });

      const activeSchedule = applicableSchedules[0];

      if (activeSchedule) {
        const baseFee = Number(activeSchedule.monthly_fee);
        // Concession is stored in invoices table, not in schedule
        // Get existing concession if invoice exists, else 0
        const { rows: existingInvoice } = await sql`
          SELECT concession_amount FROM invoices
          WHERE student_id = ${student.id} AND academic_year = ${academicYear} AND month = ${targetMonth} LIMIT 1;
        `;
        const concession = existingInvoice.length > 0? Number(existingInvoice[0].concession_amount) : 0;
        const netDue = Math.max(0, baseFee - concession);

        const result = await sql`
          INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
          VALUES (${student.id}, ${academicYear}, ${targetMonth}, ${baseFee}, ${concession}, ${netDue}, 0, 'unpaid')
          ON CONFLICT (student_id, academic_year, month) DO UPDATE SET
            base_fee = EXCLUDED.base_fee,
            net_due = GREATEST(0, EXCLUDED.base_fee - invoices.concession_amount),
            status = CASE
              WHEN invoices.status = 'new_admission' THEN 'new_admission'
              WHEN invoices.paid_amount >= GREATEST(0, EXCLUDED.base_fee - invoices.concession_amount) AND GREATEST(0, EXCLUDED.base_fee - invoices.concession_amount) > 0 THEN 'paid'
              WHEN invoices.paid_amount > 0 THEN 'partial'
              ELSE 'unpaid'
            END,
            updated_at = now()
          RETURNING student_id;
        `;
        if (result.rows.length > 0) generatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Generated ${generatedCount} invoices + ${newAdmissionCount} NEW ADMISSION for ${targetMonth} (${academicYear})`,
      generatedCount,
      newAdmissionCount
    });

  } catch (error: any) {
    console.error('Invoice Generation Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}