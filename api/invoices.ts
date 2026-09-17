import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { year, studentId } = req.query;

    let query;

    if (studentId) {
      // Fetch all invoices for a single student
      query = await sql`
        SELECT * FROM invoices 
        WHERE student_id = ${Number(studentId)} 
        ORDER BY month_year ASC;
      `;
    } else if (year) {
      // Fetch all invoices for a specific year (e.g. year=2026)
      query = await sql`
        SELECT * FROM invoices 
        WHERE EXTRACT(YEAR FROM month_year) = ${Number(year)}
        ORDER BY student_id ASC, month_year ASC;
      `;
    } else {
      // Fetch all invoices across the system
      query = await sql`
        SELECT * FROM invoices 
        ORDER BY student_id ASC, month_year ASC;
      `;
    }

    return res.status(200).json(query.rows);
  } catch (error: any) {
    console.error('Fetch Invoices Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}