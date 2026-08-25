import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api';
import type { Station } from '../shared/types';
import StationCard from '../components/StationCard';
import CloseSessionModal from '../components/CloseSessionModal';
import StartSessionModal from '../components/StartSessionModal';

export default function DashboardPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [now, setNow] = useState(Date.now());
  const [closing, setClosing] = useState<Station | null>(null);
  const [starting, setStarting] = useState<Station | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStations(await api<Station[]>('/api/stations'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000); // подхватываем изменения с других устройств
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  async function onStart(station: Station) {
    // Точки с групповым тарифом — через модалку (число людей + выбор тарифа)
    if (station.groupEnabled) {
      setStarting(station);
      return;
    }
    try {
      await api('/api/sessions/start', { method: 'POST', body: { stationId: station.id } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function onCancel(station: Station) {
    if (!station.activeSession) return;
    if (!window.confirm(`Отменить сессию на «${station.name}» без оплаты?`)) return;
    try {
      await api(`/api/sessions/${station.activeSession.id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const visible = stations.filter((s) => s.isActive);

  return (
    <div>
      <h1>Точки</h1>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="grid-stations">
        {visible.map((s) => (
          <StationCard
            key={s.id}
            station={s}
            now={now}
            onStart={onStart}
            onStop={setClosing}
            onCancel={onCancel}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <div className="muted mt">Нет активных точек. Добавь их в «Настройках».</div>
      )}
      {starting && (
        <StartSessionModal
          station={starting}
          onClose={() => setStarting(null)}
          onDone={() => {
            setStarting(null);
            load();
          }}
        />
      )}
      {closing && closing.activeSession && (
        <CloseSessionModal
          station={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
