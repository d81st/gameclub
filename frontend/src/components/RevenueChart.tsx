import { formatUZS } from '../shared/format';

interface Props {
  days: Array<{ day: string; revenue: number }>;
}

/** Столбчатый график выручки по дням (SVG, без библиотек) */
export default function RevenueChart({ days }: Props) {
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const barW = 26;
  const gap = 8;
  const chartH = 160;
  const labelH = 22;
  const width = days.length * (barW + gap) + gap;
  const height = chartH + labelH;

  function short(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'М';
    if (v >= 1_000) return Math.round(v / 1_000) + 'к';
    return String(v);
  }

  return (
    <div className="chart-scroll">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Выручка по дням"
      >
        {days.map((d, i) => {
          const h = Math.round((d.revenue / max) * (chartH - 34));
          const x = gap + i * (barW + gap);
          const y = chartH - h;
          const dayNum = d.day.slice(8, 10);
          const isZero = d.revenue === 0;
          return (
            <g key={d.day}>
              <title>{`${d.day}: ${formatUZS(d.revenue)}`}</title>
              <rect
                x={x}
                y={isZero ? chartH - 2 : y}
                width={barW}
                height={isZero ? 2 : h}
                rx={4}
                fill={isZero ? '#2a2f3a' : '#4f8cff'}
              />
              {!isZero && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#8a92a3"
                >
                  {short(d.revenue)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={chartH + 15}
                textAnchor="middle"
                fontSize="10"
                fill="#8a92a3"
              >
                {dayNum}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
