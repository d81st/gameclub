import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './errors.js';
import { query } from '../db/pool.js';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'operator';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    next(new HttpError(401, 'Требуется авторизация'));
    return;
  }
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    next(new HttpError(401, 'Сессия истекла, войдите заново'));
    return;
  }
  // Свежие роль и статус из базы: заблокированный работник теряет доступ сразу,
  // а смена роли не требует повторного входа
  query<{ username: string; role: 'admin' | 'operator'; is_active: boolean }>(
    'SELECT username, role, is_active FROM users WHERE id = $1',
    [Number(payload.sub)],
  )
    .then(({ rows }) => {
      if (!rows[0] || !rows[0].is_active) {
        next(new HttpError(401, 'Аккаунт не найден или заблокирован'));
        return;
      }
      req.user = {
        id: Number(payload.sub),
        username: rows[0].username,
        role: rows[0].role,
      };
      next();
    })
    .catch(next);
}

export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    next(new HttpError(403, 'Только для администратора'));
    return;
  }
  next();
}
