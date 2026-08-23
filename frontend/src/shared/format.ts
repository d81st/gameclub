export function formatUZS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('ru-RU').format(amount) + ' сум';
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

/** Живой таймер: ЧЧ:ММ:СС от момента старта */
export function formatElapsed(startedAt: string, now: number): string {
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Текущая сумма "на счётчике" — та же формула, что на бэкенде */
export function liveAmount(startedAt: string, hourlyRate: number, now: number): number {
  const minutes = Math.ceil(Math.max(0, now - new Date(startedAt).getTime()) / 60000);
  return Math.ceil((minutes * hourlyRate) / 60 / 100) * 100;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
};

export const TYPE_LABELS: Record<string, string> = {
  ps: 'PlayStation',
  billiard: 'Бильярд',
};
