import { cn } from "@/lib/cn";

/** Borda esquerda de 3px, fundo --surface — para a exposição confirmada (docs/design-system-v2.md § 4). */
export function InlineBanner({
  children,
  tone = "crit",
  className,
}: {
  children: React.ReactNode;
  tone?: "crit" | "med" | "ok";
  className?: string;
}) {
  const borderColor = tone === "crit" ? "border-crit" : tone === "med" ? "border-med" : "border-ok";
  return (
    <div className={cn("border-l-[3px] bg-surface px-4 py-3", borderColor, className)}>{children}</div>
  );
}
