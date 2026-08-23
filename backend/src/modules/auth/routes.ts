import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError, asyncHandler } from '../../middleware/errors.js';
import { authRequired, signToken } from '../../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Введите логин и пароль');
    const { username, password } = parsed.data;

    // Логин без учёта регистра и случайных пробелов (телефонные клавиатуры)
    const { rows } = await query<{
      id: number;
      username: string;
      password_hash: string;
      full_name: string;
      role: 'admin' | 'operator';
    }>('SELECT id, username, password_hash, full_name, role FROM users WHERE LOWER(username) = LOWER($1)', [
      username.trim(),
    ]);

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Неверный логин или пароль');
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    });
  }),
);

authRouter.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const { rows } = await query<{ id: number; username: string; full_name: string; role: string }>(
      'SELECT id, username, full_name, role FROM users WHERE id = $1',
      [req.user!.id],
    );
    if (!rows[0]) throw new HttpError(401, 'Пользователь не найден');
    res.json({
      id: rows[0].id,
      username: rows[0].username,
      fullName: rows[0].full_name,
      role: rows[0].role,
    });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Новый пароль — минимум 6 символов'),
});

authRouter.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Неверные данные');
    }
    const { currentPassword, newPassword } = parsed.data;

    const { rows } = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id],
    );
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      throw new HttpError(400, 'Текущий пароль неверен');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);
    res.json({ ok: true });
  }),
);
