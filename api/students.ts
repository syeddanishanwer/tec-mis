import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  try {
    // GET - Returns invoices + fee_schedules as single source of truth
    if (req.method === 'GET') {
      const { academicYear } = req.query;
      const year = (academicYear as string) || '2026-2027';

      const { rows } = await sql`
        SELECT
          s.id, s.serial_no, s.roll_no, s.student_name, s.father_name,
          s.class_name, s.contact_no, s.contact_no_2, s.academic_year, s.admission_date,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', i.id, 'studentId', i.student_id, 'academicYear', i.academic_year,
              'month', i.month, 'baseFee', i.base_fee, 'concessionAmount', i.concession_amount,
              'netDue', i.net_due, 'paidAmount', i.paid_amount, 'status', i.status, 
              'isWaived', COALESCE(i.is_waived, false)
            ) ORDER BY
              CASE i.month WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
              WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7 WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9
              WHEN 'Mar' THEN 10 WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END
            ) FROM invoices i WHERE i.student_id = s.id AND i.academic_year = ${year}),
            '[]'::json
          ) AS invoices,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', f.id, 'studentId', f.student_id, 'monthlyFee', f.monthly_fee,
              'effectiveFromMonth', f.effective_from_month, 'academicYear', f.academic_year
            ) ORDER BY 
              CASE f.effective_from_month WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
              WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7 WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9
              WHEN 'Mar' THEN 10 WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END
            ) FROM student_fee_schedules f WHERE f.student_id = s.id AND f.academic_year = ${year}),
            '[]'::json
          ) as fee_schedules
        FROM students s
        WHERE s.academic_year = ${year}
        ORDER BY s.id ASC;
      `;

      const students = rows.map((r: any) => ({
        id: r.id,
        serialNo: r.serial_no,
        rollNo: r.roll_no,
        studentName: r.student_name,
        fatherName: r.father_name,
        className: r.class_name,
        contactNo: r.contact_no,
        contactNo2: r.contact_no_2,
        academicYear: r.academic_year,
        admissionDate: r.admission_date,
        invoices: r.invoices || [],
        feeSchedules: r.fee_schedules || []
      }));

      return res.status(200).json(students);
    }

    // POST - Clean relational insert
    if (req.method === 'POST') {
      const { students } = req.body;
      if (!Array.isArray(students)) {
        return res.status(400).json({ error: 'Invalid payload: students array expected' });
      }

      for (const student of students) {
        const minimalData = {
          className: student.className,
          contactNo: student.contactNo,
          contactNo2: student.contactNo2,
          fatherName: student.fatherName,
        };

        const insertRes = await sql`
          INSERT INTO students (serial_no, roll_no, student_name, father_name, class_name, contact_no, contact_no_2, academic_year, admission_date, data)
          VALUES (${student.serialNo ?? null}, ${student.rollNo}, ${student.studentName}, ${student.fatherName}, ${student.className}, ${student.contactNo ?? null}, ${student.contactNo2 ?? null}, ${student.academicYear || '2026-2027'}, ${student.admissionDate ?? null}, ${JSON.stringify(minimalData)}::jsonb)
          ON CONFLICT (roll_no) DO UPDATE SET
            serial_no = EXCLUDED.serial_no,
            student_name = EXCLUDED.student_name,
            father_name = EXCLUDED.father_name,
            class_name = EXCLUDED.class_name,
            contact_no = EXCLUDED.contact_no,
            contact_no_2 = EXCLUDED.contact_no_2,
            academic_year = EXCLUDED.academic_year,
            admission_date = EXCLUDED.admission_date,
            data = EXCLUDED.data,
            updated_at = now()
          RETURNING id;
        `;

        const studentId = insertRes.rows[0]?.id;
        if (!studentId) continue;

        // 1. Handle base monthlyFee
        const baseFee = Number(student.monthlyFee || student.feeSchedules?.[0]?.monthlyFee || 0);
        if (baseFee > 0) {
          await sql`
            INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
            VALUES (${studentId}, ${baseFee}, 'Jun', ${student.academicYear || '2026-2027'})
            ON CONFLICT (student_id, effective_from_month, academic_year) 
            DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
          `;
        }

        // 2. Handle fee revisions
        const changes = student.feeChanges || student.feeSchedules || [];
        if (Array.isArray(changes) && changes.length > 0) {
          for (const change of changes) {
            const newFee = Number(change.newFee ?? change.monthlyFee ?? 0);
            const effectiveMonth = change.effectiveFromMonth;
            if (newFee > 0 && effectiveMonth && effectiveMonth !== 'Jun') {
              await sql`
                INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
                VALUES (${studentId}, ${newFee}, ${effectiveMonth}, ${student.academicYear || '2026-2027'})
                ON CONFLICT (student_id, effective_from_month, academic_year) 
                DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
              `;
            }
          }
        }
      }

      return res.status(200).json({ success: true, count: students.length });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing student id' });
      const sid = Number(id);
      await sql`DELETE FROM invoices WHERE student_id = ${sid};`;
      await sql`DELETE FROM student_fee_schedules WHERE student_id = ${sid};`;
      await sql`DELETE FROM students WHERE id = ${sid};`;
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Students Database API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}