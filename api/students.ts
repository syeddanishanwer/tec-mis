import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. FETCH ALL STUDENTS
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT data FROM students;`;

      // Safely return empty array if no rows exist yet
      if (!rows || rows.length === 0) {
        return res.status(200).json([]);
      }

      const students = rows.map((r) => r.data);
      return res.status(200).json(students);
    }

    // 2. BULK UPSERT STUDENTS
    if (req.method === 'POST') {
      const { students } = req.body;

      if (!Array.isArray(students)) {
        return res.status(400).json({ error: 'Invalid payload: students array expected' });
      }

      for (const student of students) {
        await sql`
          INSERT INTO students (id, data)
          VALUES (${student.id}, ${JSON.stringify(student)}::jsonb)
          ON CONFLICT (id) 
          DO UPDATE SET data = ${JSON.stringify(student)}::jsonb;
        `;
      }

      return res.status(200).json({ success: true, count: students.length });
    }

    // 3. DELETE STUDENT BY ID
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Missing student id' });
      }

      await sql`DELETE FROM students WHERE id = ${Number(id)};`;
      return res.status(200).json({ success: true, deletedId: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Students Database API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}