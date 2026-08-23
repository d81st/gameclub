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
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('ps', 'billiard')),
  hourly_rate  INTEGER NOT NULL CHECK (hourly_rate >= 0), -- сум/час
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
  opened_by      INTEGER NOT NULL REFERENCES users(id),
  closed_by      INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- На одной точке может быть только одна активная сессия
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_station
  ON sessions (station_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
