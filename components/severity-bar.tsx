import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/rules/types";

type BarStatus = Severity | "resolved";

const GLYPHS: Record<BarStatus, string> = {
  critical: "████",
  high: "███░",
  medium: "██░░",
  low: "█░░░",
  resolved: "▓▓▓▓",
};

const COLOR_CLASS: Record<BarStatus, string> = {
  critical: "text-sev-crit",
  high: "text-sev-high",
  medium: "text-sev-med",
  low: "text-sev-low",
  resolved: "text-graphite",
};

const LABEL: Record<BarStatus, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  resolved: "RESOLVIDO",
};

interface SeverityBarProps {
  status: BarStatus;
  showLabel?: boolean;
  className?: string;
}

/**
 * Elemento assinatura do produto (docs/design-system.md § 3). Lê-se pela
 * forma antes da cor — funciona em daltonismo e a preto e branco no PDF.
 * Não acrescentar um segundo elemento memorável ao produto.
 */
export function SeverityBar({ status, showLabel = true, className }: SeverityBarProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-data text-data", className)}>
      <span
        aria-hidden="true"
        className={cn("tracking-[-0.05em]", COLOR_CLASS[status], status === "resolved" && "line-through")}
      >
        {GLYPHS[status]}
      </span>
      {showLabel ? (
        <span className={cn("text-label uppercase tracking-[0.12em]", COLOR_CLASS[status])}>{LABEL[status]}</span>
      ) : (
        <span className="sr-only">{LABEL[status]}</span>
      )}
    </span>
  );
}
