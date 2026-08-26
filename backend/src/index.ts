import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authRouter } from './modules/auth/routes.js';
import { stationsRouter } from './modules/stations/routes.js';
import { sessionsRouter } from './modules/sessions/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { shiftsRouter } from './modules/shifts/routes.js';
import { productsRouter } from './modules/products/routes.js';
import { salesRouter } from './modules/sales/routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { pool } from './db/pool.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: false }));
app.use(express.json());

// Живость процесса (не зависит от базы — иначе деплой падает при проблемах с БД)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Диагностика подключения к базе
app.get('/api/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({
      ok: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);

// Раздача собранного фронтенда (production: frontend/dist копируется в backend/public)
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA-fallback: все не-API GET-запросы отдают index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
