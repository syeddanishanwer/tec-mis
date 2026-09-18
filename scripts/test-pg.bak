import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
  });

  console.log('Connecting...');
  await client.connect();
  console.log('Connected!');

  const res = await client.query('SELECT 1 as result;');
  console.log('Query result:', res.rows);

  await client.end();
}

main().catch((err) => {
  console.error('pg connection failed:', err);
  process.exit(1);
});