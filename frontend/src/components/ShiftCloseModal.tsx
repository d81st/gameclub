import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { formatDuration, formatUZS } from '../shared/format';

interface Pending {
  sessionsCount: number;
  totalMinutes: number;
  cashExpected: number;
  cardExpected: number;
  transferExpected: number;
  timeCash: number;
  barCash: number;
  barSalesCount: number;
  barTotal: number;
  activeSessions: number;
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function ShiftCloseModal({ onClose, onDone }: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [cashActual, setCashActual] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Pending>('/api/shifts/pending')
      .then(setPending)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'));
  }, []);

  const cashNum = cashActual.trim() === '' ? null : Number(cashActual);
  const discrepancy =
    pending && cashNum !== null && Number.isFinite(cashNum)
      ? cashNum - pending.cashExpected
      : null;

  async function submit() {
    if (cashNum === null || !Number.isInteger(cashNum) || cashNum < 0) {
      setError('Введите фактические наличные (целое число, можно 0)');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api('/api/shifts/close', {
        method: 'POST',
        body: { cashActual: cashNum, note },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Сдать смену</h3>
        {!pending && !error && <div className="muted">Загрузка…</div>}
        {pending && (
          <>
            {pending.activeSessions > 0 && (
              <div className="error-text">
                ⚠️ Сейчас идут {pending.activeSessions} сессии(й). Сначала закрой их — иначе они
                уйдут в следующую смену.
              </div>
            )}
            <div className="muted">
              Сессий: {pending.sessionsCount} · Наиграно: {formatDuration(pending.totalMinutes)}
              {pending.barSalesCount > 0 && (
                <> · 🥤 продаж: {pending.barSalesCount} на {formatUZS(pending.barTotal)}</>
              )}
            </div>
            <table className="table" style={{ fontSize: 14 }}>
              <tbody>
                <tr>
                  <td>
                    💵 Наличные (по программе)
                    {pending.barCash > 0 && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        время {formatUZS(pending.timeCash)} + бар {formatUZS(pending.barCash)}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatUZS(pending.cashExpected)}
                  </td>
                </tr>
                <tr>
                  <td>💳 Карта</td>
                  <td style={{ textAlign: 'right' }}>{formatUZS(pending.cardExpected)}</td>
                </tr>
                <tr>
                  <td>📲 Перевод</td>
                  <td style={{ textAlign: 'right' }}>{formatUZS(pending.transferExpected)}</td>
                </tr>
              </tbody>
            </table>

            <div className="field">
              <label>Наличные в кассе по факту (пересчитай!)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={cashActual}
                onChange={(e) => setCashActual(e.target.value)}
                placeholder={String(pending.cashExpected)}
              />
            </div>

            {discrepancy !== null && (
              <div
                style={{
                  fontWeight: 700,
                  color: discrepancy === 0 ? 'var(--green)' : discrepancy < 0 ? 'var(--red)' : 'var(--yellow)',
                }}
              >
                {discrepancy === 0
                  ? '✓ Касса сходится'
                  : discrepancy < 0
                    ? `Недостача: ${formatUZS(Math.abs(discrepancy))}`
                    : `Излишек: ${formatUZS(discrepancy)}`}
              </div>
            )}

            <div className="field">
              <label>Комментарий</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </>
        )}
        {error && <div className="error-text">{error}</div>}
        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !pending || pending.sessionsCount === 0}
          >
            {busy ? 'Сдача…' : 'Подтвердить сдачу'}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
