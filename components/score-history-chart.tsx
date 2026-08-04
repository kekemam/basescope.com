"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface ScorePoint {
  date: string;
  score: number;
}

function colorForScore(score: number): string {
  if (score >= 80) return "var(--sev-ok)";
  if (score >= 50) return "var(--sev-med)";
  return "var(--sev-crit)";
}

const WIDTH = 640;
const HEIGHT = 160;
const PADDING = 24;

/**
 * Série única (o score do projeto ao longo do tempo) — sem legenda, per a
 * heurística do skill de dataviz. Cor por banda de score, reaproveitando a
 * mesma convenção sev-ok/sev-med/sev-crit do ScoreBar, não uma paleta nova.
 */
export function ScoreHistoryChart({ points }: { points: ScorePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="font-prosa text-body text-graphite">Sem histórico ainda.</p>;
  }

  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PADDING + i * xStep,
    y: PADDING + innerHeight * (1 - p.score / 100),
    ...p,
  }));

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const latest = coords[coords.length - 1]!;
  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Score ao longo do tempo, atualmente ${latest.score}`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* linha base recessiva */}
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="var(--rule)" strokeWidth={1} />

        <path d={path} fill="none" stroke="var(--signal)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {coords.map((c, i) => (
          <circle
            key={c.date}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 4 : 3}
            fill={colorForScore(c.score)}
            stroke="var(--void)"
            strokeWidth={1}
          />
        ))}

        {/* hit targets maiores que o marker visível, para hover por teclado/rato */}
        {coords.map((c, i) => (
          <rect
            key={`hit-${c.date}`}
            x={c.x - xStep / 2}
            y={PADDING}
            width={Math.max(xStep, 8)}
            height={innerHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </svg>

      <div className="flex justify-between font-data text-body-sm text-graphite">
        <span>{new Date(points[0]!.date).toLocaleDateString("pt-PT")}</span>
        <span className={cn("font-data text-data")} style={{ color: colorForScore(latest.score) }}>
          {latest.score}
        </span>
        <span>{new Date(points[points.length - 1]!.date).toLocaleDateString("pt-PT")}</span>
      </div>

      {hovered && (
        <div className="absolute top-0 border border-rule bg-hull px-2 py-1 font-data text-body-sm text-bone pointer-events-none">
          {new Date(hovered.date).toLocaleDateString("pt-PT")} · score {hovered.score}
        </div>
      )}
    </div>
  );
}
