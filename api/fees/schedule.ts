import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

const VALID_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId, monthlyFee, concession, effectiveFromMonth, academicYear } = req.body;

    if (!studentId || monthlyFee === undefined || !effectiveFromMonth || !academicYear) {
      return res.status(400).json({ error: 'Missing studentId, monthlyFee, effectiveFromMonth, or academicYear' });
    }
    if (!VALID_MONTHS.includes(effectiveFromMonth)) {
      return res.status(400).json({ error: `effectiveFromMonth must be one of: ${VALID_MONTHS.join(', ')}` });
    }

    await sql`
      INSERT INTO student_fee_schedules (student_id, monthly_fee, concession, effective_from_month, academic_year)
      VALUES (${studentId}, ${monthlyFee}, ${concession ?? 0}, ${effectiveFromMonth}, ${academicYear});
    `;

    return res.status(200).json({ success: true, studentId });
  } catch (error: any) {
    console.error('Fee Schedule Endpoint Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}