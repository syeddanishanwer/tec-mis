import { sql } from '@vercel/postgres';
import { verifyAuth } from '../fees/_auth.js';

const ACADEMIC_MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'] as const;
type AcademicMonth = typeof ACADEMIC_MONTHS[number];

export default async function handler(req: any, res: any) {
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized: Access Denied' });
  }

  // GET - list all known academic years, persisted in the academic_years table
  if (req.method === 'GET') {
    try {
      const { rows } = await sql`SELECT year FROM academic_years ORDER BY year DESC;`;
      return res.status(200).json({ years: rows.map((r: any) => r.year) });
    } catch (err: any) {
      console.error('Fetch Academic Years Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to fetch academic years' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromYear, toYear } = req.body as { fromYear?: string; toYear: string };

  if (!toYear) {
    return res.status(400).json({ error: 'toYear required' });
  }
  if (fromYear && fromYear === toYear) {
    return res.status(400).json({ error: 'fromYear and toYear cannot be same' });
  }

  try {
    // Always register the year — this is what makes it show up in the dropdown
    // in every future session, not just the one where it was created.
    await sql`INSERT INTO academic_years (year) VALUES (${toYear}) ON CONFLICT (year) DO NOTHING;`;

    // No fromYear: this is just "add an empty year", no rollover requested.
    if (!fromYear) {
      return res.status(200).json({ success: true, toYear, rolledOver: false });
    }

    // Defensive: make sure fromYear is registered too (should already be, but cheap to guarantee).
    await sql`INSERT INTO academic_years (year) VALUES (${fromYear}) ON CONFLICT (year) DO NOTHING;`;

    // 1. Get all students from fromYear
    const { rows: students } = await sql`
      SELECT id, roll_no FROM students WHERE academic_year = ${fromYear};
    `;

    if (!students || students.length === 0) {
      return res.status(404).json({ error: `No students found for ${fromYear}` });
    }

    let createdInvoices = 0;
    let createdSchedules = 0;
    let skipped = 0;

    for (const student of students) {
      // 2. Get current fee (latest effective)
      const { rows: feeRows } = await sql`
        SELECT monthly_fee FROM student_fee_schedules
        WHERE student_id = ${student.id} AND academic_year = ${fromYear}
        ORDER BY
          CASE effective_from_month
            WHEN 'Jun' THEN 1 WHEN 'Jul' THEN 2 WHEN 'Aug' THEN 3 WHEN 'Sep' THEN 4
            WHEN 'Oct' THEN 5 WHEN 'Nov' THEN 6 WHEN 'Dec' THEN 7
            WHEN 'Jan' THEN 8 WHEN 'Feb' THEN 9 WHEN 'Mar' THEN 10
            WHEN 'Apr' THEN 11 WHEN 'May' THEN 12 END DESC
        LIMIT 1;
      `;

      const currentFee = feeRows.length > 0 ? Number(feeRows[0].monthly_fee) : 3500;

      // 3. Skip if already rolled over
      const { rows: existing } = await sql`
        SELECT id FROM invoices WHERE student_id = ${student.id} AND academic_year = ${toYear} LIMIT 1;
      `;
      if (existing.length > 0) { skipped++; continue; }

      // 4. Check if student record for new year exists, if not copy it
      const { rows: existingStudent } = await sql`
        SELECT id FROM students WHERE roll_no = ${student.roll_no} AND academic_year = ${toYear} LIMIT 1;
      `;

      let targetStudentId = student.id;

      if (existingStudent.length === 0) {
        // Copy student to new year
        const { rows: fullStudentRows } = await sql`
          SELECT serial_no, student_name, father_name, class_name, contact_no, contact_no_2, admission_date, data
          FROM students WHERE id = ${student.id} LIMIT 1;
        `;
        if (fullStudentRows.length > 0) {
          const fs = fullStudentRows[0];
          const newAdmDate = `${toYear.split('-')[0]}-06-01`;
          const { rows: newStudent } = await sql`
            INSERT INTO students (serial_no, roll_no, student_name, father_name, class_name, contact_no, contact_no_2, academic_year, admission_date, data)
            VALUES (${fs.serial_no}, ${fs.roll_no}, ${fs.student_name}, ${fs.father_name}, ${fs.class_name}, ${fs.contact_no}, ${fs.contact_no_2}, ${toYear}, ${newAdmDate}, ${fs.data}::jsonb)
            ON CONFLICT (roll_no, academic_year) DO UPDATE SET
              serial_no = EXCLUDED.serial_no,
              student_name = EXCLUDED.student_name,
              father_name = EXCLUDED.father_name,
              class_name = EXCLUDED.class_name,
              contact_no = EXCLUDED.contact_no,
              contact_no_2 = EXCLUDED.contact_no_2,
              data = EXCLUDED.data,
              updated_at = now()
            RETURNING id;
          `;
          if (newStudent.length > 0) targetStudentId = newStudent[0].id;
        }
      } else {
        targetStudentId = existingStudent[0].id;
      }

      // 5. Create 12 unpaid invoices for new year
      for (const month of ACADEMIC_MONTHS) {
        await sql`
          INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
          VALUES (${targetStudentId}, ${toYear}, ${month}, ${currentFee}, 0, ${currentFee}, 0, 'unpaid')
          ON CONFLICT (student_id, academic_year, month) DO NOTHING;
        `;
        createdInvoices++;
      }

      // 6. Create fee schedule Jun = currentFee
      await sql`
        INSERT INTO student_fee_schedules (student_id, monthly_fee, effective_from_month, academic_year)
        VALUES (${targetStudentId}, ${currentFee}, 'Jun', ${toYear})
        ON CONFLICT (student_id, academic_year, effective_from_month) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
      `;
      createdSchedules++;
    }

    return res.status(200).json({
      success: true,
      fromYear,
      toYear,
      rolledOver: true,
      count: students.length,
      skipped,
      createdInvoices,
      createdSchedules,
    });

  } catch (err: any) {
    console.error('Rollover error:', err);
    return res.status(500).json({ error: err.message || 'Rollover failed' });
  }
}