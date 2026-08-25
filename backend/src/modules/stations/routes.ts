import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { adminOnly, authRequired } from '../../middleware/auth.js';

export const stationsRouter = Router();
stationsRouter.use(authRequired);

const stationSchema = z
  .object({
    name: z.string().min(1, 'Укажите название'),
    type: z.enum(['ps', 'billiard']),
    hourlyRate: z.number().int().min(0, 'Тариф не может быть отрицательным'),
    groupEnabled: z.boolean().optional().default(false),
    groupRate: z.number().int().min(0).nullable().optional().default(null),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
  })
  .refine((s) => !s.groupEnabled || (s.groupRate !== null && s.groupRate > 0), {
    message: 'Для группового тарифа укажите цену при 3+ человек',
  });

stationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.id, s.name, s.type, s.hourly_rate, s.group_enabled, s.group_rate,
              s.is_active, s.sort_order,
              a.id AS active_session_id, a.started_at AS active_started_at,
              a.hourly_rate AS active_hourly_rate, a.players_count AS active_players,
              a.rate_kind AS active_rate_kind, u.username AS active_opened_by,
              u.full_name AS active_opened_by_name
       FROM stations s
       LEFT JOIN sessions a ON a.station_id = s.id AND a.status = 'active'
       LEFT JOIN users u ON u.id = a.opened_by
       ORDER BY s.sort_order, s.id`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        hourlyRate: r.hourly_rate,
        groupEnabled: r.group_enabled,
        groupRate: r.group_rate,
        isActive: r.is_active,
        sortOrder: r.sort_order,
        activeSession: r.active_session_id
          ? {
              id: r.active_session_id,
              startedAt: r.active_started_at,
              hourlyRate: r.active_hourly_rate,
              playersCount: r.active_players,
              rateKind: r.active_rate_kind,
              openedBy: r.active_opened_by_name || r.active_opened_by,
            }
          : null,
      })),
    );
  }),
);

stationsRouter.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const parsed = stationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { name, type, hourlyRate, groupEnabled, groupRate, isActive, sortOrder } = parsed.data;
    const { rows } = await query(
      `INSERT INTO stations (name, type, hourly_rate, group_enabled, group_rate, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, type, hourlyRate, groupEnabled, groupEnabled ? groupRate : null, isActive, sortOrder],
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

stationsRouter.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    const parsed = stationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { name, type, hourlyRate, groupEnabled, groupRate, isActive, sortOrder } = parsed.data;
    const { rowCount } = await query(
      `UPDATE stations SET name = $1, type = $2, hourly_rate = $3, group_enabled = $4,
              group_rate = $5, is_active = $6, sort_order = $7
       WHERE id = $8`,
      [name, type, hourlyRate, groupEnabled, groupEnabled ? groupRate : null, isActive, sortOrder, id],
    );
    if (!rowCount) throw new HttpError(404, 'Точка не найдена');
    res.json({ ok: true });
  }),
);

stationsRouter.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');

    const active = await query(
      `SELECT 1 FROM sessions WHERE station_id = $1 AND status = 'active'`,
      [id],
    );
    if (active.rowCount) throw new HttpError(400, 'Нельзя удалить точку с активной сессией');

    // Если по точке есть история — не удаляем физически, а деактивируем
    const hasHistory = await query(`SELECT 1 FROM sessions WHERE station_id = $1 LIMIT 1`, [id]);
    if (hasHistory.rowCount) {
      await query(`UPDATE stations SET is_active = FALSE WHERE id = $1`, [id]);
      res.json({ ok: true, deactivated: true });
      return;
    }

    const { rowCount } = await query(`DELETE FROM stations WHERE id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, 'Точка не найдена');
    res.json({ ok: true, deactivated: false });
  }),
);
