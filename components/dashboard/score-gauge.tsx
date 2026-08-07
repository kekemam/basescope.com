function bandColor(score: number): string {
  if (score <= 20) return "var(--crit)";
  if (score <= 40) return "var(--high)";
  if (score <= 60) return "var(--med)";
  if (score <= 80) return "var(--low)";
  return "var(--ok)";
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_COUNT = 36;

/** Anel de progresso em SVG (não canvas — é estático, sem animação por frame) com marcas radiais, estilo HUD. Cor e brilho seguem a banda do score, coerente com a legenda ao lado. */
export function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = bandColor(clamped);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const angle = (i / TICK_COUNT) * 2 * Math.PI;
          const inner = RADIUS + 7;
          const outer = RADIUS + 11;
          const x1 = 64 + inner * Math.cos(angle);
          const y1 = 64 + inner * Math.sin(angle);
          const x2 = 64 + outer * Math.cos(angle);
          const y2 = 64 + outer * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="1.5" />;
        })}
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-display-xl leading-none text-fg">{clamped}</span>
        <span className="mt-1 font-data text-body-sm text-fg-subtle">/100</span>
      </div>
    </div>
  );
}
