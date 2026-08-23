# Game Club — учёт времени для игрового клуба

Программа для клуба с PlayStation и бильярдом. Администратор вручную открывает и закрывает
сессии, система сама считает время и сумму по тарифу, ведёт историю и дневной отчёт по выручке.

- **Frontend:** React + Vite + TypeScript (тёмная тема)
- **Backend:** Node.js + Express + TypeScript (routes → thin, логика в модулях)
- **База:** PostgreSQL (облачная — Supabase, или любой другой Postgres)
- **Валюта:** UZS. Начатая минута оплачивается, сумма округляется вверх до 100 сум.

## Возможности

- Сетка точек (PS / бильярд) с живым таймером и суммой «на счётчике»
- Старт / Стоп / Отмена ошибочного старта; на одной точке не может быть двух активных сессий
- Закрытие: расчёт суммы, способ оплаты (наличные / карта / перевод), ручная корректировка суммы, заметка
- История сессий за день с фильтром по точке
- Дневной отчёт: выручка, наигранные часы, разрез по точкам и способам оплаты (часовой пояс Asia/Tashkent)
- Управление точками и тарифами, смена пароля админа
- Вход по логину-паролю (JWT)

## Настройка базы на Supabase

1. Зарегистрируйся на [supabase.com](https://supabase.com) → **New project** (регион ближе к Узбекистану — Сингапур или Франкфурт).
2. Задай пароль базы и сохрани его.
3. Открой **Project Settings → Database → Connection string (URI)** и скопируй строку —
   вида `postgresql://postgres:ПАРОЛЬ@db.xxxx.supabase.co:5432/postgres`.
   Если провайдер даёт только pooler-адрес (`...pooler.supabase.com:6543`) — он тоже подходит.

## Запуск

### Backend

```bash
cd backend
npm install
cp .env.example .env   # впиши DATABASE_URL из Supabase, DATABASE_SSL=true и свой JWT_SECRET
npm run db:migrate     # создать таблицы
npm run db:seed        # админ admin/admin123 + 4 PS и 2 бильярда
npm run dev            # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (запросы /api проксируются на :3000)
```

Вход: **admin / admin123** — сразу смени пароль в «Настройках».

## Продакшен

```bash
cd frontend && npm run build   # статика в frontend/dist
cd backend && npm run build && npm start
```

Варианты размещения:
- **Проще всего:** backend на [Render](https://render.com)/[Railway](https://railway.app) (бесплатные тарифы),
  frontend — статикой на Vercel/Netlify (в этом случае укажи адрес бэкенда в CORS_ORIGIN
  и настрой rewrite `/api` → адрес бэкенда).
- Или всё на одном дешёвом VPS: `frontend/dist` раздаёт nginx, `/api` проксируется на Node.

## Структура

```text
gameclub/
  backend/
    src/
      config.ts               # env-конфиг
      index.ts                # express-приложение
      db/                     # pool, schema.sql, migrate, seed
      middleware/             # auth (JWT), ошибки
      modules/
        auth/                 # логин, me, смена пароля
        stations/             # CRUD точек
        sessions/             # старт/стоп/отмена/история + billing.ts (расчёт)
        reports/              # дневной отчёт
  frontend/
    src/
      pages/                  # Login, Dashboard, History, Report, Settings
      components/             # Layout, StationCard, CloseSessionModal
      shared/                 # api-клиент, auth-контекст, форматирование, типы
```

## Расчёт суммы

`минуты = ceil(длительность)` → `сумма = ceil(минуты × тариф / 60 / 100) × 100`.
Тариф фиксируется на момент старта сессии (смена тарифа не влияет на уже идущие сессии).
