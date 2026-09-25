import { sql } from '@vercel/postgres';
import { verifyAuth } from './fees/_auth.js';

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method!== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { academicYear, studentId } = req.query as { academicYear?: string; studentId?: string };

    let query;
    if (studentId) {
      query = await sql`
        SELECT * FROM invoices 
        WHERE student_id = ${Number(studentId)} 
        ORDER BY academic_year ASC,
          CASE month
            WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
            WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7
            WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9 WHEN 'Mar' THEN 10
            WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END ASC;
      `;
    } else if (academicYear) {
      query = await sql`
        SELECT * FROM invoices 
        WHERE academic_year = ${academicYear} 
        ORDER BY student_id ASC,
          CASE month
            WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
            WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7
            WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9 WHEN 'Mar' THEN 10
            WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END ASC;
      `;
    } else {
      query = await sql`
        SELECT * FROM invoices 
        ORDER BY student_id ASC, academic_year ASC,
          CASE month
            WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
            WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7
            WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9 WHEN 'Mar' THEN 10
            WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END ASC;
      `;
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
      status: r.status, // 'unpaid' | 'partial' | 'paid' | 'new_admission'
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