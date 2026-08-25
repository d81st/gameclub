import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api';
import {
  formatDateTime,
  formatDuration,
  formatUZS,
  PAYMENT_LABELS,
  todayLocalISO,
} from '../shared/format';
import type { SessionRow, Station } from '../shared/types';
import { useAuth } from '../shared/auth';
import ShiftCloseModal from '../components/ShiftCloseModal';

export default function HistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [date, setDate] = useState(todayLocalISO());
  const [stationId, setStationId] = useState('');
  const [stations, setStations] = useState<Station[]>([]);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState('');
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftMsg, setShiftMsg] = useState('');

  useEffect(() => {
    api<Station[]>('/api/stations').then(setStations).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      // Локальный день: от 00:00 выбранной даты до 00:00 следующего дня
      const from = new Date(`${date}T00:00:00`);
      const to = new Date(from.getTime() + 24 * 3600 * 1000);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (stationId) params.set('stationId', stationId);
      setRows(await api<SessionRow[]>(`/api/sessions?${params.toString()}`));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, [date, stationId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = rows
    .filter((r) => r.status === 'closed')
    .reduce((sum, r) => sum + (r.amountFinal ?? 0), 0);

  return (
    <div>
      <h1>{isAdmin ? 'История сессий' : 'Сессии за сегодня'}</h1>
      <div className="filters">
        {isAdmin && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        <select value={stationId} onChange={(e) => setStationId(e.target.value)}>
          <option value="">Все точки</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="muted">
          Сессий: {rows.length} · Итого: <b>{formatUZS(total)}</b>
        </span>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShiftModal(true)}>
            💰 Сдать смену
          </button>
        )}
      </div>
      {shiftMsg && <div className="muted" style={{ marginBottom: 10 }}>{shiftMsg}</div>}
      {error && <div className="error-text">{error}</div>}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Точка</th>
              <th>Начало</th>
              <th>Конец</th>
              <th>Время</th>
              <th>Чел.</th>
              <th>Сумма</th>
              <th>Оплата</th>
              <th>Заметка</th>
              {isAdmin && <th>Закрыл</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.stationName}</td>
                <td>{formatDateTime(r.startedAt)}</td>
                <td>{formatDateTime(r.endedAt)}</td>
                <td>{r.minutes !== null ? formatDuration(r.minutes) : '—'}</td>
                <td className="muted">
                  {r.playersCount ?? '—'}
                  {r.rateKind === 'group' ? ' 👥' : ''}
                </td>
                <td>
                  {r.status === 'cancelled' ? (
                    <span className="badge cancelled">Отменена</span>
                  ) : (
                    formatUZS(r.amountFinal)
                  )}
                </td>
                <td>{r.paymentMethod ? PAYMENT_LABELS[r.paymentMethod] : '—'}</td>
                <td className="muted">{r.note}</td>
                {isAdmin && <td className="muted">{r.closedBy ?? '—'}</td>}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="muted">
                  Нет сессий за выбранный день
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {shiftModal && (
        <ShiftCloseModal
          onClose={() => setShiftModal(false)}
          onDone={() => {
            setShiftModal(false);
            setShiftMsg('✓ Смена сдана');
            load();
          }}
        />
      )}
    </div>
  );
}
