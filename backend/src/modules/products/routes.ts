import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { adminOnly, authRequired } from '../../middleware/auth.js';

export const productsRouter = Router();
productsRouter.use(authRequired);

// Список товаров: работник видит только активные, админ — все
productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const onlyActive = req.user!.role !== 'admin';
    const { rows } = await query(
      `SELECT id, name, price, category, is_active, sort_order
       FROM products
       ${onlyActive ? 'WHERE is_active' : ''}
       ORDER BY sort_order, name`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        category: r.category,
        isActive: r.is_active,
        sortOrder: r.sort_order,
      })),
    );
  }),
);

const productSchema = z.object({
  name: z.string().min(1, 'Укажите название').max(60),
  price: z.number().int().min(0, 'Цена не может быть отрицательной'),
  category: z.enum(['drink', 'snack', 'other']).optional().default('drink'),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

productsRouter.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { name, price, category, isActive, sortOrder } = parsed.data;
    const { rows } = await query(
      `INSERT INTO products (name, price, category, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), price, category, isActive, sortOrder],
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

productsRouter.put(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { name, price, category, isActive, sortOrder } = parsed.data;
    const { rowCount } = await query(
      `UPDATE products SET name = $1, price = $2, category = $3, is_active = $4, sort_order = $5
       WHERE id = $6`,
      [name.trim(), price, category, isActive, sortOrder, id],
    );
    if (!rowCount) throw new HttpError(404, 'Товар не найден');
    res.json({ ok: true });
  }),
);

productsRouter.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    // Если товар уже продавался — не удаляем физически, а скрываем (история должна остаться)
    const used = await query('SELECT 1 FROM sale_items WHERE product_id = $1 LIMIT 1', [id]);
    if (used.rowCount) {
      await query('UPDATE products SET is_active = FALSE WHERE id = $1', [id]);
      res.json({ ok: true, hidden: true });
      return;
    }
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, 'Товар не найден');
    res.json({ ok: true, hidden: false });
  }),
);
