-- Схема базы для учёта времени игрового клуба (PS + бильярд)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('ps', 'billiard')),
  hourly_rate   INTEGER NOT NULL CHECK (hourly_rate >= 0), -- сум/час (стандарт, 1-2 чел)
  group_enabled BOOLEAN NOT NULL DEFAULT FALSE,            -- групповой тариф включён (напр. PS3)
  group_rate    INTEGER,                                   -- сум/час при 3+ человек
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id                SERIAL PRIMARY KEY,
  closed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by         INTEGER NOT NULL REFERENCES users(id),
  sessions_count    INTEGER NOT NULL,
  total_minutes     INTEGER NOT NULL,
  cash_expected     BIGINT NOT NULL,   -- наличные по программе
  card_expected     BIGINT NOT NULL,
  transfer_expected BIGINT NOT NULL,
  cash_actual       BIGINT,            -- наличные по факту (пересчёт кассы)
  discrepancy       BIGINT,            -- факт минус программа (минус = недостача)
  note              TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  id             SERIAL PRIMARY KEY,
  station_id     INTEGER NOT NULL REFERENCES stations(id),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ,
  hourly_rate    INTEGER NOT NULL,          -- снимок тарифа на момент старта
  minutes        INTEGER,                   -- итоговые минуты (заполняется при закрытии)
  amount         INTEGER,                   -- рассчитанная сумма, сум
  amount_final   INTEGER,                   -- фактически взятая сумма (может отличаться)
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  note           TEXT NOT NULL DEFAULT '',
  players_count  INTEGER,                                  -- сколько человек (для группового тарифа)
  rate_kind      TEXT NOT NULL DEFAULT 'standard' CHECK (rate_kind IN ('standard','group')),
  opened_by      INTEGER NOT NULL REFERENCES users(id),
  closed_by      INTEGER REFERENCES users(id),
  shift_id       INTEGER REFERENCES shifts(id), -- заполняется при сдаче смены
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_shift ON sessions (shift_id);

-- На одной точке может быть только одна активная сессия
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_station
  ON sessions (station_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);

-- Бар: каталог товаров и продажи
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL CHECK (price >= 0),
  category   TEXT NOT NULL DEFAULT 'drink' CHECK (category IN ('drink','snack','other')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id             SERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     INTEGER NOT NULL REFERENCES users(id),
  session_id     INTEGER REFERENCES sessions(id), -- если привязано к точке, оплата при закрытии сессии
  payment_method TEXT CHECK (payment_method IN ('cash','card','transfer')),
  total          BIGINT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  shift_id       INTEGER REFERENCES shifts(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id           SERIAL PRIMARY KEY,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,   -- снимок названия на момент продажи
  unit_price   INTEGER NOT NULL, -- снимок цены
  qty          INTEGER NOT NULL CHECK (qty > 0),
  amount       BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales (session_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales (shift_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id);
