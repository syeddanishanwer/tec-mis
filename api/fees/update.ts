import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, updatedStudent } = req.body;

    if (!studentId || !updatedStudent) {
      return res.status(400).json({ error: 'Missing studentId or updatedStudent payload' });
    }

    // Upsert record: insert if missing, or update data JSON column on conflict
    await sql`
      INSERT INTO students (id, data)
      VALUES (${studentId}, ${JSON.stringify(updatedStudent)}::jsonb)
      ON CONFLICT (id) 
      DO UPDATE SET data = ${JSON.stringify(updatedStudent)}::jsonb;
    `;

    return res.status(200).json({ success: true, id: studentId });
  } catch (error: any) {
    console.error('Update Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}