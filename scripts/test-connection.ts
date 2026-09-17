import 'dotenv/config';
import { sql } from '@vercel/postgres';

sql`SELECT 1 as result;`
  .then((r) => console.log('Connected:', r.rows))
  .catch((e) => console.error('Failed:', e.message));