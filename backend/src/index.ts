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
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { pool } from './db/pool.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: false }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'База данных недоступна' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/reports', reportsRouter);

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
