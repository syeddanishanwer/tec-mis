import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid payload: students array expected' });
  }

  try {
    await sql`BEGIN`;
    await sql`DELETE FROM students;`;
    for (const student of students) {
      await sql`
        INSERT INTO students (id, data)
        VALUES (${student.id}, ${JSON.stringify(student)}::jsonb);
      `;
    }
    await sql`COMMIT`;
    return res.status(200).json({ success: true, count: students.length });
  } catch (error: any) {
    await sql`ROLLBACK`;
    console.error('Replace Students Error:', error);
    return res.status(500).json({ error: error.message });
  }
}