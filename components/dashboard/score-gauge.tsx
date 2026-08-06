function bandColor(score: number): string {
  if (score <= 20) return "var(--crit)";
  if (score <= 40) return "var(--high)";
  if (score <= 60) return "var(--med)";
  if (score <= 80) return "var(--low)";
  return "var(--ok)";
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anel de progresso em SVG (não canvas — é estático, sem animação por frame). Cor e brilho seguem a banda do score, coerente com a legenda ao lado. */
export function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = bandColor(clamped);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-display-xl leading-none text-fg">{clamped}</span>
        <span className="mt-1 font-data text-body-sm text-fg-subtle">/100</span>
      </div>
    </div>
  );
}
