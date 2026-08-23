import { Router } from 'express';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { authRequired } from '../../middleware/auth.js';
import { config } from '../../config.js';

export const reportsRouter = Router();
reportsRouter.use(authRequired);

// Отчёт за период: выручка по дням + итоги + разрез по точкам
reportsRouter.get(
  '/range',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
      throw new HttpError(400, 'Укажите from и to в формате YYYY-MM-DD');
    }
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    if (days < 0 || days > 62) throw new HttpError(400, 'Период — максимум 62 дня');
    const tz = config.clubTimezone;

    const byDay = await query(
      `SELECT (ended_at AT TIME ZONE $3)::date::text AS day,
              COUNT(*)::int AS sessions_count,
              COALESCE(SUM(minutes), 0)::int AS total_minutes,
              COALESCE(SUM(amount_final), 0)::bigint AS revenue
       FROM sessions
       WHERE status = 'closed'
         AND (ended_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY day
       ORDER BY day`,
      [from, to, tz],
    );

    const byStation = await query(
      `SELECT st.id, st.name, st.type,
              COUNT(*)::int AS sessions_count,
              COALESCE(SUM(se.minutes), 0)::int AS total_minutes,
              COALESCE(SUM(se.amount_final), 0)::bigint AS revenue
       FROM sessions se
       JOIN stations st ON st.id = se.station_id
       WHERE se.status = 'closed'
         AND (se.ended_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY st.id, st.name, st.type
       ORDER BY revenue DESC`,
      [from, to, tz],
    );

    const daysMap = new Map(byDay.rows.map((r) => [r.day, r]));
    const series: Array<{
      day: string;
      sessionsCount: number;
      totalMinutes: number;
      revenue: number;
    }> = [];
    for (let t = new Date(`${from}T00:00:00Z`); ; t = new Date(t.getTime() + 86400000)) {
      const key = t.toISOString().slice(0, 10);
      if (key > to) break;
      const r = daysMap.get(key);
      series.push({
        day: key,
        sessionsCount: r ? r.sessions_count : 0,
        totalMinutes: r ? r.total_minutes : 0,
        revenue: r ? Number(r.revenue) : 0,
      });
    }

    res.json({
      from,
      to,
      days: series,
      sessionsCount: series.reduce((s, d) => s + d.sessionsCount, 0),
      totalMinutes: series.reduce((s, d) => s + d.totalMinutes, 0),
      revenue: series.reduce((s, d) => s + d.revenue, 0),
      byStation: byStation.rows.map((r) => ({
        stationId: r.id,
        name: r.name,
        type: r.type,
        sessionsCount: r.sessions_count,
        totalMinutes: r.total_minutes,
        revenue: Number(r.revenue),
      })),
    });
  }),
);

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
