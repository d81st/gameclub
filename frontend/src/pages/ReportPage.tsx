import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api';
import {
  formatDuration,
  formatUZS,
  PAYMENT_LABELS,
  todayLocalISO,
  TYPE_LABELS,
} from '../shared/format';
import type { DailyReport, RangeReport } from '../shared/types';
import RevenueChart from '../components/RevenueChart';

type Mode = 'day' | 'week' | 'month' | 'shifts';

interface ShiftRow {
  id: number;
  closedAt: string;
  closedBy: string;
  sessionsCount: number;
  totalMinutes: number;
  cashExpected: number;
  cardExpected: number;
  transferExpected: number;
  cashActual: number | null;
  discrepancy: number | null;
  note: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Диапазон недели (пн–вс) или календарного месяца, содержащего дату */
function rangeFor(mode: Mode, dateISO: string): { from: string; to: string } {
  const d = new Date(`${dateISO}T00:00:00`);
  if (mode === 'week') {
    const shift = (d.getDay() + 6) % 7; // 0 = понедельник
    const mon = new Date(d.getTime() - shift * 86400000);
    const sun = new Date(mon.getTime() + 6 * 86400000);
    return { from: toISO(mon), to: toISO(sun) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toISO(first), to: toISO(last) };
}

const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export default function ReportPage() {
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(todayLocalISO());
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [range, setRange] = useState<RangeReport | null>(null);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      if (mode === 'shifts') {
        setShifts(await api<ShiftRow[]>('/api/shifts'));
      } else if (mode === 'day') {
        setDaily(await api<DailyReport>(`/api/reports/daily?date=${date}`));
      } else {
        const { from, to } = rangeFor(mode, date);
        setRange(await api<RangeReport>(`/api/reports/range?from=${from}&to=${to}`));
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, [mode, date]);

  useEffect(() => {
    load();
  }, [load]);

  const report = mode === 'day' ? daily : mode === 'shifts' ? null : range;
  const periodLabel =
    mode === 'day' || mode === 'shifts'
      ? null
      : mode === 'week'
        ? `${rangeFor('week', date).from} — ${rangeFor('week', date).to}`
        : `${RU_MONTHS[new Date(`${date}T00:00:00`).getMonth()]} ${new Date(`${date}T00:00:00`).getFullYear()}`;

  return (
    <div>
      <h1>Отчёты</h1>

      <div className="filters">
        <div className="seg">
          {(['day', 'week', 'month', 'shifts'] as Mode[]).map((m) => (
            <button
              key={m}
              className={`seg-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'day' ? 'День' : m === 'week' ? 'Неделя' : m === 'month' ? 'Месяц' : 'Смены'}
            </button>
          ))}
        </div>
        {mode !== 'shifts' && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
      </div>
      {periodLabel && <div className="muted" style={{ marginBottom: 12 }}>{periodLabel}</div>}
      {error && <div className="error-text">{error}</div>}

      {mode === 'shifts' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Кто сдал</th>
                <th>Сессий</th>
                <th>💵 Программа</th>
                <th>💵 Факт</th>
                <th>Расхождение</th>
                <th>💳 Карта</th>
                <th>📲 Перевод</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.closedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.closedBy}</td>
                  <td>{s.sessionsCount}</td>
                  <td>{formatUZS(s.cashExpected)}</td>
                  <td>{formatUZS(s.cashActual)}</td>
                  <td style={{ fontWeight: 700, color: (s.discrepancy ?? 0) === 0 ? 'var(--green)' : (s.discrepancy ?? 0) < 0 ? 'var(--red)' : 'var(--yellow)' }}>
                    {s.discrepancy === null ? '—' : s.discrepancy === 0 ? '✓ 0' : formatUZS(s.discrepancy)}
                  </td>
                  <td>{formatUZS(s.cardExpected)}</td>
                  <td>{formatUZS(s.transferExpected)}</td>
                  <td className="muted">{s.note}</td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">Смены ещё не сдавались</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {report && (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Всего выручка</div>
              <div className="value">{formatUZS(report.totalRevenue)}</div>
            </div>
            <div className="stat">
              <div className="label">⏱ Время</div>
              <div className="value">{formatUZS(report.revenue)}</div>
            </div>
            <div className="stat">
              <div className="label">🥤 Бар</div>
              <div className="value">{formatUZS(report.barRevenue)}</div>
            </div>
            <div className="stat">
              <div className="label">Сессий</div>
              <div className="value">{report.sessionsCount}</div>
            </div>
            <div className="stat">
              <div className="label">Наиграно</div>
              <div className="value">{formatDuration(report.totalMinutes)}</div>
            </div>
          </div>

          {report.topProducts?.length > 0 && (
            <>
              <h2>🥤 Топ товаров</h2>
              <div className="card" style={{ padding: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Продано</th>
                      <th>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{p.qty} шт</td>
                        <td>{formatUZS(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {mode !== 'day' && range && (
            <>
              <h2>Выручка по дням</h2>
              <div className="card">
                <RevenueChart days={range.days} />
              </div>
            </>
          )}

          <h2>По точкам</h2>
          <div className="card" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Точка</th>
                  <th>Тип</th>
                  <th>Сессий</th>
                  <th>Время</th>
                  <th>Выручка</th>
                </tr>
              </thead>
              <tbody>
                {report.byStation.map((s) => (
                  <tr key={s.stationId}>
                    <td>{s.name}</td>
                    <td>
                      <span className={`badge ${s.type}`}>{TYPE_LABELS[s.type]}</span>
                    </td>
                    <td>{s.sessionsCount}</td>
                    <td>{formatDuration(s.totalMinutes)}</td>
                    <td>{formatUZS(s.revenue)}</td>
                  </tr>
                ))}
                {report.byStation.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Нет закрытых сессий
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {mode === 'day' && daily && (
            <>
              <h2>По способу оплаты</h2>
              <div className="card" style={{ padding: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Способ</th>
                      <th>Сессий</th>
                      <th>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.byPayment.map((p) => (
                      <tr key={p.method}>
                        <td>{PAYMENT_LABELS[p.method] ?? p.method}</td>
                        <td>{p.sessionsCount}</td>
                        <td>{formatUZS(p.revenue)}</td>
                      </tr>
                    ))}
                    {daily.byPayment.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
