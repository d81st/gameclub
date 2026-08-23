/**
 * Расчёт стоимости сессии.
 * Минуты округляются вверх (начатая минута оплачивается),
 * сумма округляется вверх до ближайших 100 сум.
 */
export function calcMinutes(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60000);
}

export function calcAmount(minutes: number, hourlyRate: number): number {
  const raw = (minutes * hourlyRate) / 60;
  return Math.ceil(raw / 100) * 100;
}
