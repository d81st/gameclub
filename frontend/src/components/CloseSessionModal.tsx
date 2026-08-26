import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth';
import { formatDuration, formatUZS, PAYMENT_LABELS } from '../shared/format';
import type { PaymentMethod, Station } from '../shared/types';

interface Props {
  station: Station;
  onClose: () => void;
  onDone: () => void;
}

export default function CloseSessionModal({ station, onClose, onDone }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const sessionId = station.activeSession!.id;
  const [preview, setPreview] = useState<{
    minutes: number;
    amount: number;
    barAmount: number;
    barItems: Array<{ name: string; qty: number; amount: number }>;
    totalAmount: number;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [override, setOverride] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<NonNullable<typeof preview>>(`/api/sessions/${sessionId}/preview`)
      .then(setPreview)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'));
  }, [sessionId]);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const amountFinal = isAdmin && override.trim() !== '' ? Number(override) : undefined;
      if (amountFinal !== undefined && (!Number.isInteger(amountFinal) || amountFinal < 0)) {
        setError('Сумма должна быть целым неотрицательным числом');
        setBusy(false);
        return;
      }
      await api(`/api/sessions/${sessionId}/close`, {
        method: 'POST',
        body: { paymentMethod, amountFinal, note },
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
        <h3>Закрыть сессию — {station.name}</h3>
        {preview ? (
          <div>
            <div className="muted">
              Время: {formatDuration(preview.minutes)} — {formatUZS(preview.amount)}
            </div>
            {preview.barAmount > 0 && (
              <>
                <div className="muted" style={{ marginTop: 4 }}>
                  🥤 Бар: {formatUZS(preview.barAmount)}
                  {preview.barItems?.length ? (
                    <span> ({preview.barItems.map((i) => `${i.name}×${i.qty}`).join(', ')})</span>
                  ) : null}
                </div>
              </>
            )}
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
              Итого: {formatUZS(preview.totalAmount)}
            </div>
          </div>
        ) : (
          <div className="muted">Расчёт…</div>
        )}

        <div className="field">
          <label>Способ оплаты</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div className="field">
            <label>Другая сумма (если взяли не по счётчику)</label>
            <input
              type="number"
              min={0}
              step={100}
              placeholder={preview ? String(preview.amount) : ''}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label>Заметка</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="btn-row">
          <button className="btn btn-stop" onClick={submit} disabled={busy || !preview}>
            {busy ? 'Закрытие…' : 'Закрыть и оплатить'}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
