import { cn } from "@/lib/cn";

const BLOCK_COUNT = 4;

function colorForScore(score: number): string {
  if (score >= 80) return "text-sev-ok";
  if (score >= 50) return "text-sev-med";
  return "text-sev-crit";
}

/**
 * Mesmo glifo de 4 blocos da SeverityBar (docs/design-system.md § 4, rail
 * de projetos), mas aqui proporcional ao score 0–100 em vez de codificar
 * uma severidade fixa — por isso é um componente próprio, não uma variante
 * da SeverityBar.
 */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const filled = Math.max(0, Math.min(BLOCK_COUNT, Math.round((score / 100) * BLOCK_COUNT)));
  const glyph = "█".repeat(filled) + "░".repeat(BLOCK_COUNT - filled);

  return (
    <span className={cn("inline-flex items-center gap-2 font-data text-data", className)}>
      <span aria-hidden="true" className={cn("tracking-[-0.05em]", colorForScore(score))}>
        {glyph}
      </span>
      <span className="text-bone">{score}</span>
    </span>
  );
}
