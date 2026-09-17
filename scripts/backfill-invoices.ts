import 'dotenv/config';
import { Client } from 'pg';
import type { StudentRecord, AcademicMonth, PaymentStatus } from '../src/types';

function mapStatus(status: PaymentStatus): 'paid' | 'unpaid' | 'partial' {
  if (status === 'paid') return 'paid';
  if (status === 'partial') return 'partial';
  return 'unpaid';
}

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const { rows } = await client.query('SELECT id, data FROM students;');
  let scheduleCount = 0;
  let invoiceCount = 0;

  for (const row of rows) {
    const s: StudentRecord = row.data;
    console.log(`Processing student ${s.id}: ${s.studentName}`);

    const baseAmount = s.monthlyFee ?? 0;
    const concession = s.discount ?? 0;
    const effectiveFrom = s.admissionDate ?? '2020-01-01';

    await client.query(
      `INSERT INTO student_fee_schedules (student_id, base_amount, concession, effective_from)
       VALUES ($1, $2, $3, $4);`,
      [s.id, baseAmount, concession, effectiveFrom]
    );
    scheduleCount++;

    if (s.monthlyStatus) {
      for (const month of Object.keys(s.monthlyStatus) as AcademicMonth[]) {
        const status = s.monthlyStatus[month];
        const paidAmount = s.monthlyAmountsPaid?.[month] ?? 0;
        const netDue = baseAmount - concession;

        await client.query(
          `INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (student_id, academic_year, month) DO NOTHING;`,
          [s.id, s.academicYear, month, baseAmount, concession, netDue, paidAmount, mapStatus(status)]
        );
        invoiceCount++;
      }
    }

    if (s.yearlyStatus) {
      for (const year of Object.keys(s.yearlyStatus)) {
        const monthsForYear = s.yearlyStatus[year];
        for (const month of Object.keys(monthsForYear) as AcademicMonth[]) {
          const status = monthsForYear[month];
          const paidAmount = s.yearlyAmountsPaid?.[year]?.[month] ?? 0;
          const netDue = baseAmount - concession;

          await client.query(
            `INSERT INTO invoices (student_id, academic_year, month, base_fee, concession_amount, net_due, paid_amount, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (student_id, academic_year, month) DO NOTHING;`,
            [s.id, year, month, baseAmount, concession, netDue, paidAmount, mapStatus(status)]
          );
          invoiceCount++;
        }
      }
    }
  }

  await client.end();
  console.log(`Backfilled ${rows.length} students, ${scheduleCount} schedules, ${invoiceCount} invoice rows.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});