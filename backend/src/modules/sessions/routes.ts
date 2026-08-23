import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { authRequired } from '../../middleware/auth.js';
import { calcAmount, calcMinutes } from './billing.js';
import { config } from '../../config.js';

export const sessionsRouter = Router();
sessionsRouter.use(authRequired);

// Старт сессии на точке
sessionsRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ stationId: z.number().int() }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Укажите точку');
    const { stationId } = parsed.data;

    const st = await query<{ id: number; hourly_rate: number; is_active: boolean }>(
      'SELECT id, hourly_rate, is_active FROM stations WHERE id = $1',
      [stationId],
    );
    if (!st.rows[0]) throw new HttpError(404, 'Точка не найдена');
    if (!st.rows[0].is_active) throw new HttpError(400, 'Точка выключена');

    try {
      const { rows } = await query(
        `INSERT INTO sessions (station_id, hourly_rate, opened_by)
         VALUES ($1, $2, $3)
         RETURNING id, started_at`,
        [stationId, st.rows[0].hourly_rate, req.user!.id],
      );
      res.status(201).json({ id: rows[0].id, startedAt: rows[0].started_at });
    } catch (err: unknown) {
      // Уникальный индекс: одна активная сессия на точку
      if ((err as { code?: string }).code === '23505') {
        throw new HttpError(409, 'На этой точке уже идёт сессия');
      }
      throw err;
    }
  }),
);

const closeSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  amountFinal: z.number().int().min(0).optional(), // ручная корректировка суммы
  note: z.string().max(500).optional().default(''),
});

// Закрытие сессии с расчётом суммы
sessionsRouter.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Укажите способ оплаты');
    const { paymentMethod, amountFinal, note } = parsed.data;

    // Ручная корректировка суммы — только для админа (защита от злоупотреблений)
    if (amountFinal !== undefined && req.user!.role !== 'admin') {
      throw new HttpError(403, 'Изменить сумму может только администратор');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(
        `SELECT id, started_at, hourly_rate FROM sessions
         WHERE id = $1 AND status = 'active' FOR UPDATE`,
        [id],
      );
      if (!cur.rows[0]) {
        throw new HttpError(404, 'Активная сессия не найдена');
      }
      const endedAt = new Date();
      const minutes = calcMinutes(new Date(cur.rows[0].started_at), endedAt);
      const amount = calcAmount(minutes, cur.rows[0].hourly_rate);
      const finalAmount = amountFinal ?? amount;

      await client.query(
        `UPDATE sessions
         SET status = 'closed', ended_at = $1, minutes = $2, amount = $3,
             amount_final = $4, payment_method = $5, note = $6, closed_by = $7
         WHERE id = $8`,
        [endedAt, minutes, amount, finalAmount, paymentMethod, note, req.user!.id, id],
      );
      await client.query('COMMIT');
      res.json({ id, minutes, amount, amountFinal: finalAmount, endedAt });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

// Предпросмотр суммы без закрытия (для модалки "Стоп")
sessionsRouter.get(
  '/:id/preview',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    const { rows } = await query(
      `SELECT started_at, hourly_rate FROM sessions WHERE id = $1 AND status = 'active'`,
      [id],
    );
    if (!rows[0]) throw new HttpError(404, 'Активная сессия не найдена');
    const minutes = calcMinutes(new Date(rows[0].started_at), new Date());
    res.json({ minutes, amount: calcAmount(minutes, rows[0].hourly_rate) });
  }),
);

// Отмена сессии (ошибочный старт)
sessionsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');

    // Работник может отменить только в первые 5 минут (исправление ошибочного старта)
    if (req.user!.role !== 'admin') {
      const cur = await query<{ started_at: Date }>(
        `SELECT started_at FROM sessions WHERE id = $1 AND status = 'active'`,
        [id],
      );
      if (!cur.rows[0]) throw new HttpError(404, 'Активная сессия не найдена');
      const ageMs = Date.now() - new Date(cur.rows[0].started_at).getTime();
      if (ageMs > 5 * 60 * 1000) {
        throw new HttpError(403, 'Отменить сессию старше 5 минут может только администратор');
      }
    }

    const { rowCount } = await query(
      `UPDATE sessions
       SET status = 'cancelled', ended_at = now(), closed_by = $1
       WHERE id = $2 AND status = 'active'`,
      [req.user!.id, id],
    );
    if (!rowCount) throw new HttpError(404, 'Активная сессия не найдена');
    res.json({ ok: true });
  }),
);

// История сессий с фильтрами
sessionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    let from = typeof req.query.from === 'string' ? req.query.from : null;
    let to = typeof req.query.to === 'string' ? req.query.to : null;
    const stationId = req.query.stationId ? Number(req.query.stationId) : null;
    const limit = Math.min(Number(req.query.limit ?? 200), 500);

    const conditions: string[] = [`se.status <> 'active'`];
    const params: unknown[] = [];

    // Работник видит историю только за сегодняшний день клуба
    if (req.user!.role !== 'admin') {
      from = null;
      to = null;
      params.push(config.clubTimezone);
      conditions.push(
        `(se.started_at AT TIME ZONE $${params.length})::date = (now() AT TIME ZONE $${params.length})::date`,
      );
    }
    if (from) {
      params.push(from);
      conditions.push(`se.started_at >= $${params.length}::timestamptz`);
    }
    if (to) {
      params.push(to);
      conditions.push(`se.started_at < $${params.length}::timestamptz`);
    }
    if (stationId) {
      params.push(stationId);
      conditions.push(`se.station_id = $${params.length}`);
    }
    params.push(limit);

    const { rows } = await query(
      `SELECT se.id, se.station_id, st.name AS station_name, st.type AS station_type,
              se.status, se.started_at, se.ended_at, se.hourly_rate, se.minutes,
              se.amount, se.amount_final, se.payment_method, se.note,
              u.username AS closed_by_username
       FROM sessions se
       JOIN stations st ON st.id = se.station_id
       LEFT JOIN users u ON u.id = se.closed_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY se.started_at DESC
       LIMIT $${params.length}`,
      params,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        stationId: r.station_id,
        stationName: r.station_name,
        stationType: r.station_type,
        status: r.status,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        hourlyRate: r.hourly_rate,
        minutes: r.minutes,
        amount: r.amount,
        amountFinal: r.amount_final,
        paymentMethod: r.payment_method,
        note: r.note,
        closedBy: r.closed_by_username,
      })),
    );
  }),
);
