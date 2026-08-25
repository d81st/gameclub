import { useAuth } from '../shared/auth';
import { formatElapsed, formatUZS, liveAmount, TYPE_LABELS } from '../shared/format';
import type { Station } from '../shared/types';

interface Props {
  station: Station;
  now: number;
  onStart: (station: Station) => void;
  onStop: (station: Station) => void;
  onCancel: (station: Station) => void;
}

export default function StationCard({ station, now, onStart, onStop, onCancel }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const active = station.activeSession;
  // Работник может отменить только первые 5 минут; админ — всегда
  const canCancel =
    !!active &&
    (isAdmin || now - new Date(active.startedAt).getTime() <= 5 * 60 * 1000);

  return (
    <div className={`card station-card ${active ? 'busy' : ''}`}>
      <div className="station-head">
        <span className="station-name">{station.name}</span>
        <span className={`badge ${station.type}`}>{TYPE_LABELS[station.type]}</span>
      </div>
      <div className="station-rate">
        {formatUZS(station.hourlyRate)}/час
        {station.groupEnabled && station.groupRate ? (
          <span> · 3+: {formatUZS(station.groupRate)}</span>
        ) : null}
      </div>

      {active ? (
        <>
          <div className="timer">{formatElapsed(active.startedAt, now)}</div>
          <div className="live-amount">
            {formatUZS(liveAmount(active.startedAt, active.hourlyRate, now))}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {active.playersCount ? `${active.playersCount} чел` : ''}
            {active.rateKind === 'group' ? ' · групповой' : ''}
            {active.openedBy ? `${active.playersCount || active.rateKind === 'group' ? ' · ' : ''}открыл: ${active.openedBy}` : ''}
          </div>
          <div className="btn-row">
            <button className="btn btn-stop" onClick={() => onStop(station)}>
              {isAdmin ? 'Закрыть (аварийно)' : 'Стоп'}
            </button>
            {canCancel && (
              <button className="btn btn-ghost" onClick={() => onCancel(station)}>
                Отмена
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="idle-label">Свободно</div>
          {!isAdmin && (
            <button className="btn btn-start" onClick={() => onStart(station)}>
              Старт
            </button>
          )}
        </>
      )}
    </div>
  );
}
