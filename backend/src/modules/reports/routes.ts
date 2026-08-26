import { Router } from 'express';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { adminOnly, authRequired } from '../../middleware/auth.js';
import { config } from '../../config.js';

export const reportsRouter = Router();
reportsRouter.use(authRequired);

/** Сегодняшняя дата в часовом поясе клуба (YYYY-MM-DD) */
function todayInClubTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: config.clubTimezone });
}

// Отчёт за период: выручка по дням + итоги + разрез по точкам (только админ)
reportsRouter.get(
  '/range',
  adminOnly,
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
      barRevenue?: number;
      totalRevenue?: number;
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

    // Бар за период: по дням и топ товаров
    const barByDay = await query(
      `SELECT (created_at AT TIME ZONE $3)::date::text AS day,
              COUNT(*)::int AS sales_count,
              COALESCE(SUM(total), 0)::bigint AS revenue
       FROM sales
       WHERE deleted_at IS NULL AND payment_method IS NOT NULL
         AND (created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY day`,
      [from, to, tz],
    );
    const barMap = new Map(barByDay.rows.map((r) => [r.day, Number(r.revenue)]));
    for (const d of series) {
      d.barRevenue = barMap.get(d.day) ?? 0;
      d.totalRevenue = d.revenue + d.barRevenue;
    }

    const topProducts = await query(
      `SELECT si.product_name AS name, SUM(si.qty)::int AS qty,
              COALESCE(SUM(si.amount), 0)::bigint AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.deleted_at IS NULL AND s.payment_method IS NOT NULL
         AND (s.created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY si.product_name
       ORDER BY revenue DESC
       LIMIT 10`,
      [from, to, tz],
    );

    const barRevenue = series.reduce((s, d) => s + (d.barRevenue ?? 0), 0);
    const timeRevenue = series.reduce((s, d) => s + d.revenue, 0);

    res.json({
      from,
      to,
      days: series,
      sessionsCount: series.reduce((s, d) => s + d.sessionsCount, 0),
      totalMinutes: series.reduce((s, d) => s + d.totalMinutes, 0),
      revenue: timeRevenue,
      barRevenue,
      totalRevenue: timeRevenue + barRevenue,
      topProducts: topProducts.rows.map((r) => ({
        name: r.name,
        qty: r.qty,
        revenue: Number(r.revenue),
      })),
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
    let date = typeof req.query.date === 'string' ? req.query.date : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Укажите дату в формате YYYY-MM-DD');
    }
    // Работник видит итог только за сегодня (нужно для сдачи кассы)
    if (req.user!.role !== 'admin') {
      date = todayInClubTz();
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

    // Бар за этот день
    const bar = await query(
      `SELECT COUNT(*)::int AS sales_count, COALESCE(SUM(total), 0)::bigint AS revenue
       FROM sales
       WHERE deleted_at IS NULL AND payment_method IS NOT NULL
         AND (created_at AT TIME ZONE $2)::date = $1::date`,
      [date, tz],
    );
    const topProducts = await query(
      `SELECT si.product_name AS name, SUM(si.qty)::int AS qty,
              COALESCE(SUM(si.amount), 0)::bigint AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.deleted_at IS NULL AND s.payment_method IS NOT NULL
         AND (s.created_at AT TIME ZONE $2)::date = $1::date
       GROUP BY si.product_name
       ORDER BY revenue DESC
       LIMIT 10`,
      [date, tz],
    );

    res.json({
      date,
      sessionsCount: totals.rows[0].sessions_count,
      totalMinutes: totals.rows[0].total_minutes,
      revenue: Number(totals.rows[0].revenue),
      barSalesCount: bar.rows[0].sales_count,
      barRevenue: Number(bar.rows[0].revenue),
      totalRevenue: Number(totals.rows[0].revenue) + Number(bar.rows[0].revenue),
      topProducts: topProducts.rows.map((r) => ({
        name: r.name,
        qty: r.qty,
        revenue: Number(r.revenue),
      })),
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
