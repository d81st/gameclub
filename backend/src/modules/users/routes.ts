import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { adminOnly, authRequired } from '../../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(authRequired, adminOnly);

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, username, full_name, role, is_active, created_at
       FROM users ORDER BY role, username`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        isActive: r.is_active,
        createdAt: r.created_at,
      })),
    );
  }),
);

const createSchema = z.object({
  username: z
    .string()
    .min(3, 'Логин — минимум 3 символа')
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Логин — только латиница, цифры и _ . -'),
  password: z.string().min(6, 'Пароль — минимум 6 символов'),
  fullName: z.string().max(100).optional().default(''),
});

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { username, password, fullName } = parsed.data;

    const exists = await query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [
      username.trim(),
    ]);
    if (exists.rowCount) throw new HttpError(409, 'Такой логин уже занят');

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'operator') RETURNING id`,
      [username.trim(), hash, fullName.trim()],
    );
    res.status(201).json({ id: rows[0].id });
  }),
);

usersRouter.post(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    const parsed = z.object({ newPassword: z.string().min(6, 'Пароль — минимум 6 символов') }).safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    const { rowCount } = await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    if (!rowCount) throw new HttpError(404, 'Пользователь не найден');
    res.json({ ok: true });
  }),
);

usersRouter.post(
  '/:id/active',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Неверный id');
    if (id === req.user!.id) throw new HttpError(400, 'Нельзя заблокировать самого себя');
    const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Неверные данные');
    const { rowCount } = await query('UPDATE users SET is_active = $1 WHERE id = $2', [
      parsed.data.isActive,
      id,
    ]);
    if (!rowCount) throw new HttpError(404, 'Пользователь не найден');
    res.json({ ok: true });
  }),
);
