import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { adminOnly, authRequired } from '../../middleware/auth.js';

export const shiftsRouter = Router();
// Сдача смены и просмотр смен — только админ
shiftsRouter.use(authRequired, adminOnly);

/** Итоги несданных сессий (то, что войдёт в сдаваемую смену) */
shiftsRouter.get(
  '/pending',
  asyncHandler(async (_req, res) => {
    const totals = await query(
      `SELECT COUNT(*)::int AS sessions_count,
              COALESCE(SUM(minutes), 0)::int AS total_minutes,
              COALESCE(SUM(amount_final) FILTER (WHERE payment_method = 'cash'), 0)::bigint AS cash,
              COALESCE(SUM(amount_final) FILTER (WHERE payment_method = 'card'), 0)::bigint AS card,
              COALESCE(SUM(amount_final) FILTER (WHERE payment_method = 'transfer'), 0)::bigint AS transfer
       FROM sessions
       WHERE status = 'closed' AND shift_id IS NULL`,
    );
    const active = await query(
      `SELECT COUNT(*)::int AS n FROM sessions WHERE status = 'active'`,
    );
    const r = totals.rows[0];
    res.json({
      sessionsCount: r.sessions_count,
      totalMinutes: r.total_minutes,
      cashExpected: Number(r.cash),
      cardExpected: Number(r.card),
      transferExpected: Number(r.transfer),
      activeSessions: active.rows[0].n,
    });
  }),
);

const closeSchema = z.object({
  cashActual: z.number().int().min(0),
  note: z.string().max(500).optional().default(''),
});

/** Сдать смену: зафиксировать итоги, привязать сессии, посчитать расхождение */
shiftsRouter.post(
  '/close',
  asyncHandler(async (req, res) => {
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Укажите фактические наличные');
    const { cashActual, note } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Блокируем несданные сессии, чтобы параллельная сдача не задвоила смену
      const pending = await client.query(
        `SELECT id, minutes, amount_final, payment_method
         FROM sessions
         WHERE status = 'closed' AND shift_id IS NULL
         FOR UPDATE`,
      );
      if (pending.rows.length === 0) {
        throw new HttpError(400, 'Нет закрытых сессий для сдачи смены');
      }

      let cash = 0;
      let card = 0;
      let transfer = 0;
      let minutes = 0;
      for (const s of pending.rows) {
        minutes += s.minutes ?? 0;
        const amt = Number(s.amount_final ?? 0);
        if (s.payment_method === 'cash') cash += amt;
        else if (s.payment_method === 'card') card += amt;
        else if (s.payment_method === 'transfer') transfer += amt;
      }

      const shift = await client.query(
        `INSERT INTO shifts
           (closed_by, sessions_count, total_minutes, cash_expected, card_expected,
            transfer_expected, cash_actual, discrepancy, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, closed_at`,
        [
          req.user!.id,
          pending.rows.length,
          minutes,
          cash,
          card,
          transfer,
          cashActual,
          cashActual - cash,
          note,
        ],
      );
      const shiftId = shift.rows[0].id;

      // Привязываем сданные сессии (и отменённые тоже, чтобы не висели)
      await client.query(
        `UPDATE sessions SET shift_id = $1 WHERE status <> 'active' AND shift_id IS NULL`,
        [shiftId],
      );

      await client.query('COMMIT');
      res.status(201).json({
        id: shiftId,
        closedAt: shift.rows[0].closed_at,
        sessionsCount: pending.rows.length,
        cashExpected: cash,
        cardExpected: card,
        transferExpected: transfer,
        cashActual,
        discrepancy: cashActual - cash,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/** Список смен (только админ) */
shiftsRouter.get(
  '/',
  adminOnly,
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT sh.id, sh.closed_at, u.username AS closed_by, u.full_name AS closed_by_name,
              sh.sessions_count, sh.total_minutes, sh.cash_expected, sh.card_expected,
              sh.transfer_expected, sh.cash_actual, sh.discrepancy, sh.note
       FROM shifts sh
       JOIN users u ON u.id = sh.closed_by
       ORDER BY sh.closed_at DESC
       LIMIT 100`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        closedAt: r.closed_at,
        closedBy: r.closed_by_name || r.closed_by,
        sessionsCount: r.sessions_count,
        totalMinutes: r.total_minutes,
        cashExpected: Number(r.cash_expected),
        cardExpected: Number(r.card_expected),
        transferExpected: Number(r.transfer_expected),
        cashActual: r.cash_actual === null ? null : Number(r.cash_actual),
        discrepancy: r.discrepancy === null ? null : Number(r.discrepancy),
        note: r.note,
      })),
    );
  }),
);
