import { useState } from 'react';
import { useAuth } from '../shared/auth';
import { formatElapsed, formatUZS, liveAmount, TYPE_LABELS } from '../shared/format';
import type { Station } from '../shared/types';

interface Props {
  station: Station;
  now: number;
  onStart: (station: Station) => void;
  onStop: (station: Station) => void;
  onCancel: (station: Station) => void;
  onBar: (station: Station) => void;
}

export default function StationCard({ station, now, onStart, onStop, onCancel, onBar }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [menu, setMenu] = useState(false);
  const active = station.activeSession;

  // Работник может отменить только первые 5 минут; админ — всегда
  const canCancel =
    !!active && (isAdmin || now - new Date(active.startedAt).getTime() <= 5 * 60 * 1000);

  if (!active) {
    return (
      <div className="card station-card free">
        <div className="station-head">
          <span className="station-name">{station.name}</span>
          <span className={`badge ${station.type}`}>{TYPE_LABELS[station.type]}</span>
        </div>
        <div className="station-rate">
          {formatUZS(station.hourlyRate)}/час
          {station.groupEnabled && station.groupRate ? (
            <span> · 👥 3+: {formatUZS(station.groupRate)}</span>
          ) : null}
        </div>
        <div className="idle-label">Свободно</div>
        {!isAdmin && (
          <button className="btn btn-start" onClick={() => onStart(station)}>
            Старт
          </button>
        )}
      </div>
    );
  }

  const timeAmount = liveAmount(active.startedAt, active.hourlyRate, now);
  const barAmount = active.barAmount ?? 0;

  return (
    <div className="card station-card busy">
      <div className="station-head">
        <span className="station-name">{station.name}</span>
        <span className={`badge ${station.type}`}>{TYPE_LABELS[station.type]}</span>
      </div>
      <div className="station-meta">
        {formatUZS(active.hourlyRate)}/час
        {active.playersCount ? ` · 👥 ${active.playersCount} чел` : ''}
        {active.rateKind === 'group' ? ' (групповой)' : ''}
        {active.openedBy ? ` · ${active.openedBy}` : ''}
      </div>

      <div className="station-body">
        <div className="timer">{formatElapsed(active.startedAt, now)}</div>
        <div className="amounts">
          <div className="amount-row">
            <span>Время</span>
            <span>{formatUZS(timeAmount)}</span>
          </div>
          {barAmount > 0 && (
            <div className="amount-row">
              <span>🥤 Бар</span>
              <span>{formatUZS(barAmount)}</span>
            </div>
          )}
          <div className="amount-row total">
            <span>Итого</span>
            <span>{formatUZS(timeAmount + barAmount)}</span>
          </div>
        </div>
      </div>

      <div className="station-actions">
        {!isAdmin && (
          <button className="btn btn-secondary" onClick={() => onBar(station)}>
            + Бар
          </button>
        )}
        <button className="btn btn-stop" onClick={() => onStop(station)}>
          {isAdmin ? 'Закрыть' : 'Стоп'}
        </button>
        {canCancel && (
          <div className="menu-wrap">
            <button className="btn btn-ghost" onClick={() => setMenu((v) => !v)} title="Ещё">
              ⋯
            </button>
            {menu && (
              <div className="menu-pop">
                <button
                  onClick={() => {
                    setMenu(false);
                    onCancel(station);
                  }}
                >
                  Отменить без оплаты
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
