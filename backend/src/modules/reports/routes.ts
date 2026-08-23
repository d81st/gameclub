import { Router } from 'express';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { authRequired } from '../../middleware/auth.js';
import { config } from '../../config.js';

export const reportsRouter = Router();
reportsRouter.use(authRequired);

// Дневной отчёт: выручка за локальный день клуба (по времени закрытия сессии)
reportsRouter.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Укажите дату в формате YYYY-MM-DD');
    }
    const tz = config.clubTimezone;

    const totals = await query(
      `SELECT COUNT(*)::int AS sessions_count,
              COALESCE(SUM(minutes), 0)::int AS total_minutes,
              COALESCE(SUM(amount_final), 0)::bigint AS revenue
       FROM sessions
       WHERE status = 'closed'
         AND (ended_at AT TIME ZONE $2)::date = $1::date`,
      [date, tz],
    );

    const byStation = await query(
      `SELECT st.id, st.name, st.type,
              COUNT(*)::int AS sessions_count,
              COALESCE(SUM(se.minutes), 0)::int AS total_minutes,
              COALESCE(SUM(se.amount_final), 0)::bigint AS revenue
       FROM sessions se
       JOIN stations st ON st.id = se.station_id
       WHERE se.status = 'closed'
         AND (se.ended_at AT TIME ZONE $2)::date = $1::date
       GROUP BY st.id, st.name, st.type
       ORDER BY revenue DESC`,
      [date, tz],
    );

    const byPayment = await query(
      `SELECT payment_method,
              COUNT(*)::int AS sessions_count,
              COALESCE(SUM(amount_final), 0)::bigint AS revenue
       FROM sessions
       WHERE status = 'closed'
         AND (ended_at AT TIME ZONE $2)::date = $1::date
       GROUP BY payment_method`,
      [date, tz],
    );

    res.json({
      date,
      sessionsCount: totals.rows[0].sessions_count,
      totalMinutes: totals.rows[0].total_minutes,
      revenue: Number(totals.rows[0].revenue),
      byStation: byStation.rows.map((r) => ({
        stationId: r.id,
        name: r.name,
        type: r.type,
        sessionsCount: r.sessions_count,
        totalMinutes: r.total_minutes,
        revenue: Number(r.revenue),
      })),
      byPayment: byPayment.rows.map((r) => ({
        method: r.payment_method,
        sessionsCount: r.sessions_count,
        revenue: Number(r.revenue),
      })),
    });
  }),
);
