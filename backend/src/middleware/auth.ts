import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './errors.js';

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
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    req.user = {
      id: Number(payload.sub),
      username: String(payload.username),
      role: payload.role === 'operator' ? 'operator' : 'admin',
    };
    next();
  } catch {
    next(new HttpError(401, 'Сессия истекла, войдите заново'));
  }
}

export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    next(new HttpError(403, 'Только для администратора'));
    return;
  }
  next();
}
