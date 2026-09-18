import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { academicYear, studentId } = req.query;

    let query;
    if (studentId) {
      query = await sql`SELECT * FROM invoices WHERE student_id = ${Number(studentId)} ORDER BY academic_year ASC, month ASC;`;
    } else if (academicYear) {
      query = await sql`SELECT * FROM invoices WHERE academic_year = ${academicYear as string} ORDER BY student_id ASC, month ASC;`;
    } else {
      query = await sql`SELECT * FROM invoices ORDER BY student_id ASC, month ASC;`;
    }

    const invoices = query.rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      academicYear: r.academic_year,
      month: r.month,
      baseFee: Number(r.base_fee),
      concessionAmount: Number(r.concession_amount),
      netDue: Number(r.net_due),
      paidAmount: Number(r.paid_amount),
      status: r.status,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.status(200).json(invoices);
  } catch (error: any) {
    console.error('Fetch Invoices Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}