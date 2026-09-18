// scripts/backfill-invoices.ts
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function main() {
  const { rows } = await sql`SELECT id, data FROM students;`;
  for (const row of rows) {
    const s = row.data;
    // insert one schedule row per student using s.monthlyFee, s.discount, s.admissionDate
    // insert one invoice row per month found in s.monthlyAmountsPaid / s.monthlyStatus
    // (fill in your actual field-mapping logic here)
  }
  console.log(`Backfilled ${rows.length} students`);
}

main();