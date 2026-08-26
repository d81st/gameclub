import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { authRequired } from '../../middleware/auth.js';
import { config } from '../../config.js';

export const salesRouter = Router();
salesRouter.use(authRequired);

const createSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.number().int(), qty: z.number().int().min(1).max(99) }))
      .min(1, 'Корзина пуста'),
    // Либо сразу оплата, либо привязка к активной сессии (оплатят при закрытии)
    paymentMethod: z.enum(['cash', 'card', 'transfer']).optional(),
    sessionId: z.number().int().optional(),
    note: z.string().max(300).optional().default(''),
  })
  .refine((d) => !!d.paymentMethod !== !!d.sessionId, {
    message: 'Выберите способ оплаты или точку (что-то одно)',
  });

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Продаёт только работник за стойкой — админ наблюдает
    if (req.user!.role === 'admin') {
      throw new HttpError(403, 'Продажи оформляет работник');
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { items, paymentMethod, sessionId, note } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (sessionId) {
        const s = await client.query(
          `SELECT 1 FROM sessions WHERE id = $1 AND status = 'active'`,
          [sessionId],
        );
        if (!s.rowCount) throw new HttpError(400, 'На этой точке нет активной сессии');
      }

      // Цены берём из базы (работник не может подменить цену)
      const ids = items.map((i) => i.productId);
      const prods = await client.query<{ id: number; name: string; price: number; is_active: boolean }>(
        `SELECT id, name, price, is_active FROM products WHERE id = ANY($1::int[])`,
        [ids],
      );
      const byId = new Map(prods.rows.map((p) => [p.id, p]));

      let total = 0;
      const rowsToInsert: Array<[number, string, number, number, number]> = [];
      for (const it of items) {
        const p = byId.get(it.productId);
        if (!p) throw new HttpError(400, 'Товар не найден');
        if (!p.is_active) throw new HttpError(400, `Товар «${p.name}» недоступен`);
        const amount = p.price * it.qty;
        total += amount;
        rowsToInsert.push([p.id, p.name, p.price, it.qty, amount]);
      }

      const sale = await client.query(
        `INSERT INTO sales (created_by, session_id, payment_method, total, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
        [req.user!.id, sessionId ?? null, paymentMethod ?? null, total, note],
      );
      const saleId = sale.rows[0].id;

      for (const [pid, pname, price, qty, amount] of rowsToInsert) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, qty, amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [saleId, pid, pname, price, qty, amount],
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ id: saleId, total, createdAt: sale.rows[0].created_at });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/** Список продаж: работник — только за сегодня, админ — с фильтром по датам */
salesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params: unknown[] = [];
    const conditions: string[] = ['s.deleted_at IS NULL'];

    if (req.user!.role !== 'admin') {
      params.push(config.clubTimezone);
      conditions.push(
        `(s.created_at AT TIME ZONE $${params.length})::date = (now() AT TIME ZONE $${params.length})::date`,
      );
    } else {
      const from = typeof req.query.from === 'string' ? req.query.from : null;
      const to = typeof req.query.to === 'string' ? req.query.to : null;
      if (from) {
        params.push(from);
        conditions.push(`s.created_at >= $${params.length}::timestamptz`);
      }
      if (to) {
        params.push(to);
        conditions.push(`s.created_at < $${params.length}::timestamptz`);
      }
    }

    const { rows } = await query(
      `SELECT s.id, s.created_at, s.total, s.payment_method, s.session_id, s.note,
              u.username AS created_by, u.full_name AS created_by_name,
              st.name AS station_name,
              COALESCE(
                json_agg(json_build_object('name', si.product_name, 'qty', si.qty, 'amount', si.amount)
                         ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL),
                '[]'
              ) AS items
       FROM sales s
       JOIN users u ON u.id = s.created_by
       LEFT JOIN sessions se ON se.id = s.session_id
       LEFT JOIN stations st ON st.id = se.station_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY s.id, u.username, u.full_name, st.name
       ORDER BY s.created_at DESC
       LIMIT 300`,
      params,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        total: Number(r.total),
        paymentMethod: r.payment_method,
        sessionId: r.session_id,
        stationName: r.station_name,
        note: r.note,
        createdBy: r.created_by_name || r.created_by,
        items: r.items,
      })),
    );
  }),
);

/** Товары, висящие на конкретной активной сессии (для окна заказа с карточки точки) */
salesRouter.get(
  '/session/:sessionId',
  asyncHandler(async (req, res) => {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId)) throw new HttpError(400, 'Неверный id');
    const { rows } = await query(
      `SELECT s.id, s.created_at, s.total,
              COALESCE(
                json_agg(json_build_object('name', si.product_name, 'qty', si.qty, 'amount', si.amount)
                         ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL),
                '[]'
              ) AS items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.session_id = $1 AND s.payment_method IS NULL AND s.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY s.created_at`,
      [sessionId],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        total: Number(r.total),
        items: r.items,
      })),
    );
  }),
);

/** Удаление продажи: работник — только свою и в первые 5 минут, админ — любую */
salesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');

    const cur = await query<{
      created_at: Date;
      created_by: number;
      shift_id: number | null;
      deleted_at: Date | null;
    }>('SELECT created_at, created_by, shift_id, deleted_at FROM sales WHERE id = $1', [id]);
    if (!cur.rows[0] || cur.rows[0].deleted_at) throw new HttpError(404, 'Продажа не найдена');

    if (req.user!.role !== 'admin') {
      if (cur.rows[0].created_by !== req.user!.id) {
        throw new HttpError(403, 'Можно удалить только свою продажу');
      }
      const ageMs = Date.now() - new Date(cur.rows[0].created_at).getTime();
      if (ageMs > 5 * 60 * 1000) {
        throw new HttpError(403, 'Удалить продажу старше 5 минут может только администратор');
      }
    }
    if (cur.rows[0].shift_id !== null) {
      throw new HttpError(400, 'Продажа уже вошла в сданную смену');
    }

    await query('UPDATE sales SET deleted_at = now(), deleted_by = $1 WHERE id = $2', [
      req.user!.id,
      id,
    ]);
    res.json({ ok: true });
  }),
);
