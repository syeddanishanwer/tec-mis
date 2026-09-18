import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

const ACADEMIC_MONTH_ORDER = [
  'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAuthenticatedUser = await verifyAuth(req);

  if (!isCronRequest && !isAuthenticatedUser) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month: targetMonth, academicYear } = req.body || {};

    if (!targetMonth || !academicYear) {
      return res.status(400).json({ error: 'Missing required fields: month and academicYear' });
    }

    const targetMonthIndex = ACADEMIC_MONTH_ORDER.indexOf(targetMonth);
    if (targetMonthIndex === -1) {
      return res.status(400).json({ error: `Invalid target month: ${targetMonth}` });
    }

    const { rows: students } = await sql`
      SELECT id FROM students WHERE academic_year = ${academicYear};
    `;

    const { rows: schedules } = await sql`
      SELECT id, student_id, monthly_fee, concession, effective_from_month 
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

    for (const student of students) {
      const studentSchedules = scheduleMap.get(student.id) || [];

      const applicableSchedules = studentSchedules.filter((sched) => {
        const schedMonthIndex = ACADEMIC_MONTH_ORDER.indexOf(sched.effective_from_month);
        return schedMonthIndex !== -1 && schedMonthIndex <= targetMonthIndex;
      });

      applicableSchedules.sort((a, b) => {
        const idxA = ACADEMIC_MONTH_ORDER.indexOf(a.effective_from_month);
        const idxB = ACADEMIC_MONTH_ORDER.indexOf(b.effective_from_month);
        return idxB - idxA;
      });

      const activeSchedule = applicableSchedules[0];

      if (activeSchedule) {
        const baseFee = Number(activeSchedule.monthly_fee);
        const concession = Number(activeSchedule.concession || 0);
        const netDue = baseFee - concession;

        const result = await sql`
          INSERT INTO invoices (
            student_id, academic_year, month, base_fee, concession_amount, net_due, status
          )
          VALUES (
            ${student.id}, ${academicYear}, ${targetMonth}, ${baseFee}, ${concession}, ${netDue}, 'unpaid'
          )
          ON CONFLICT (student_id, academic_year, month) DO NOTHING
          RETURNING student_id;
        `;
        if (result.rows.length > 0) generatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${generatedCount} invoices for ${targetMonth} (${academicYear})`,
    });
  } catch (error: any) {
    console.error('Invoice Generation Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}