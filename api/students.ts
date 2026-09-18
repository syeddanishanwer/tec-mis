import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  try {
    if (req.method === 'GET') {
      const { academicYear } = req.query;
      
      // Fetch students and join/query fee schedules if needed, or extract safely from jsonb data
      const { rows } = academicYear
        ? await sql`SELECT id, serial_no, roll_no, student_name, father_name, class_name, contact_no, contact_no_2, academic_year, admission_date, data FROM students WHERE academic_year = ${academicYear as string} ORDER BY id ASC;`
        : await sql`SELECT id, serial_no, roll_no, student_name, father_name, class_name, contact_no, contact_no_2, academic_year, admission_date, data FROM students ORDER BY id ASC;`;

      // Also pull explicit fee schedules for these students to keep multi-slot records fully synchronized
      const students = await Promise.all(
        rows.map(async (r) => {
          const rawData = r.data || {};
          
          // Fetch any active database fee changes from student_fee_schedules table
          const scheduleRes = await sql`
            SELECT monthly_fee as "newFee", effective_from_month as "effectiveFromMonth"
            FROM student_fee_schedules
            WHERE student_id = ${r.id}
            ORDER BY id ASC;
          `;

          // Fallback to jsonb feeChanges if schedules table is empty, or ensure empty array
          const feeChanges = scheduleRes.rows.length > 0 
            ? scheduleRes.rows 
            : (Array.isArray(rawData.feeChanges) ? rawData.feeChanges : []);

          return {
            ...rawData,
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
            feeChanges: Array.isArray(feeChanges) ? feeChanges : [],
            monthlyStatus: rawData.monthlyStatus || {},
            monthlyAmountsPaid: rawData.monthlyAmountsPaid || {},
          };
        })
      );

      return res.status(200).json(students);
    }

    if (req.method === 'POST') {
      const { students } = req.body;
      if (!Array.isArray(students)) {
        return res.status(400).json({ error: 'Invalid payload: students array expected' });
      }

      for (const student of students) {
        const insertRes = await sql`
          INSERT INTO students (serial_no, roll_no, student_name, father_name, class_name, contact_no, contact_no_2, academic_year, admission_date, data)
          VALUES (${student.serialNo ?? null}, ${student.rollNo}, ${student.studentName}, ${student.fatherName}, ${student.className}, ${student.contactNo ?? null}, ${student.contactNo2 ?? null}, ${student.academicYear}, ${student.admissionDate ?? null}, ${JSON.stringify(student)}::jsonb)
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

        // If student payload contains explicit feeChanges, sync them to student_fee_schedules table
        if (studentId && Array.isArray(student.feeChanges) && student.feeChanges.length > 0) {
          for (const change of student.feeChanges) {
            if (change.newFee && change.effectiveFromMonth) {
              await sql`
                INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
                VALUES (${studentId}, ${change.newFee}, ${change.effectiveFromMonth}, ${student.academicYear})
                ON CONFLICT DO NOTHING;
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
      await sql`DELETE FROM students WHERE id = ${Number(id)};`;
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Students Database API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}