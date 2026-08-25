import { useState } from 'react';
import { api } from '../shared/api';
import { formatUZS } from '../shared/format';
import type { Station } from '../shared/types';

interface Props {
  station: Station;
  onClose: () => void;
  onDone: () => void;
}

/** Старт на точке с групповым тарифом: число людей + выбор тарифа (решает работник) */
export default function StartSessionModal({ station, onClose, onDone }: Props) {
  const [players, setPlayers] = useState(2);
  const [rateKind, setRateKind] = useState<'standard' | 'group'>('standard');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function setPlayersSafe(n: number) {
    const v = Math.max(1, Math.min(20, n));
    setPlayers(v);
    // 1-2 человека — только стандартный тариф; при 3+ по умолчанию предлагаем групповой
    if (v < 3) setRateKind('standard');
    else setRateKind('group');
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await api('/api/sessions/start', {
        method: 'POST',
        body: { stationId: station.id, playersCount: players, rateKind },
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
        <h3>Старт — {station.name}</h3>

        <div className="field">
          <label>Сколько человек?</label>
          <div className="players-picker">
            <button type="button" className="btn btn-secondary" onClick={() => setPlayersSafe(players - 1)}>
              −
            </button>
            <span className="players-num">{players}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setPlayersSafe(players + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="field">
          <label>Тариф</label>
          <div className="rate-options">
            <button
              type="button"
              className={`rate-option ${rateKind === 'standard' ? 'active' : ''}`}
              onClick={() => setRateKind('standard')}
            >
              <div>Стандарт (1–2 чел)</div>
              <b>{formatUZS(station.hourlyRate)}/час</b>
            </button>
            <button
              type="button"
              className={`rate-option ${rateKind === 'group' ? 'active' : ''}`}
              onClick={() => players >= 3 && setRateKind('group')}
              disabled={players < 3}
            >
              <div>Групповой (3+ чел)</div>
              <b>{formatUZS(station.groupRate)}/час</b>
            </button>
          </div>
          {players >= 3 && rateKind === 'standard' && (
            <div className="muted" style={{ fontSize: 13 }}>
              {players} человек — можно открыть и по стандартному, решаешь ты
            </div>
          )}
        </div>

        {error && <div className="error-text">{error}</div>}
        <div className="btn-row">
          <button className="btn btn-start" onClick={submit} disabled={busy}>
            {busy ? 'Старт…' : `Старт · ${formatUZS(rateKind === 'group' ? station.groupRate : station.hourlyRate)}/час`}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
