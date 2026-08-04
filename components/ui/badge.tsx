import { cn } from "@/lib/cn";

const VARIANT_CLASSES: Record<string, string> = {
  open: "text-crit border-crit/40 bg-crit/10",
  fixed: "text-ok border-ok/40 bg-ok/10",
  ignored: "text-fg-subtle border-border-str bg-surface-2",
  false_positive: "text-fg-subtle border-border-str bg-surface-2",
  // Estado de regra (ecrã /regras), não de achado — ver lib/data/rule-status.ts.
  passing: "text-ok border-ok/40 bg-ok/10",
  failing: "text-crit border-crit/40 bg-crit/10",
  unverified: "text-fg-subtle border-border-str bg-surface-2",
};

const LABEL: Record<string, string> = {
  open: "Aberto",
  fixed: "Resolvido",
  ignored: "Ignorado",
  false_positive: "Falso positivo",
  passing: "A passar",
  failing: "A falhar",
  unverified: "Não verificada",
};

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 h-5 font-data text-[11px] uppercase tracking-[0.04em]",
        VARIANT_CLASSES[status] ?? VARIANT_CLASSES.open,
        className,
      )}
    >
      {LABEL[status] ?? status}
    </span>
  );
}
