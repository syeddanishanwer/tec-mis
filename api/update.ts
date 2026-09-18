import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, updatedStudent } = req.body;

    if (!studentId || !updatedStudent) {
      return res.status(400).json({ error: 'Missing studentId or updatedStudent payload' });
    }

    await sql`
      UPDATE students SET
        serial_no = ${updatedStudent.serialNo ?? null},
        roll_no = ${updatedStudent.rollNo},
        student_name = ${updatedStudent.studentName},
        father_name = ${updatedStudent.fatherName},
        class_name = ${updatedStudent.className},
        contact_no = ${updatedStudent.contactNo ?? null},
        contact_no_2 = ${updatedStudent.contactNo2 ?? null},
        academic_year = ${updatedStudent.academicYear},
        admission_date = ${updatedStudent.admissionDate ?? null},
        data = ${JSON.stringify(updatedStudent)}::jsonb,
        updated_at = now()
      WHERE id = ${studentId};
    `;

    return res.status(200).json({ success: true, id: studentId });
  } catch (error: any) {
    console.error('Update Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}