import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

async function main() {
  // Админ по умолчанию: admin / admin123 — смени пароль после первого входа!
  const passwordHash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    ['admin', passwordHash, 'Администратор'],
  );

  const stations: Array<[string, string, number, number]> = [
    ['PS 1', 'ps', 15000, 1],
    ['PS 2', 'ps', 15000, 2],
    ['PS 3', 'ps', 15000, 3],
    ['PS 4', 'ps', 15000, 4],
    ['Бильярд 1', 'billiard', 40000, 5],
    ['Бильярд 2', 'billiard', 40000, 6],
  ];

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM stations');
  if (rows[0].n === 0) {
    for (const [name, type, rate, order] of stations) {
      await pool.query(
        `INSERT INTO stations (name, type, hourly_rate, sort_order) VALUES ($1, $2, $3, $4)`,
        [name, type, rate, order],
      );
    }
    console.log('Stations seeded.');
  } else {
    console.log('Stations already exist, skipping.');
  }

  console.log('Seed done. Login: admin / admin123');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
