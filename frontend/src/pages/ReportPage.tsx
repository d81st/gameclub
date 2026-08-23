import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api';
import {
  formatDuration,
  formatUZS,
  PAYMENT_LABELS,
  todayLocalISO,
  TYPE_LABELS,
} from '../shared/format';
import type { DailyReport } from '../shared/types';

export default function ReportPage() {
  const [date, setDate] = useState(todayLocalISO());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setReport(await api<DailyReport>(`/api/reports/daily?date=${date}`));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1>Отчёт за день</h1>
      <div className="filters">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <div className="error-text">{error}</div>}
      {report && (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Выручка</div>
              <div className="value">{formatUZS(report.revenue)}</div>
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
                {report.byPayment.map((p) => (
                  <tr key={p.method}>
                    <td>{PAYMENT_LABELS[p.method] ?? p.method}</td>
                    <td>{p.sessionsCount}</td>
                    <td>{formatUZS(p.revenue)}</td>
                  </tr>
                ))}
                {report.byPayment.length === 0 && (
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
    </div>
  );
}
