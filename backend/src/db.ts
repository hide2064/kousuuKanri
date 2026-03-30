import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'kousuu',
  password: process.env.DB_PASSWORD || 'kousuu_pass',
  database: process.env.DB_NAME || 'kousuu_kanri',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

export async function waitForDb(retries = 15, delayMs = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected');
      return;
    } catch {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to database after retries');
}

export default pool;
