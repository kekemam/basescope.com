import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-signal text-void hover:bg-signal/90",
  ghost: "bg-transparent text-bone border border-rule hover:border-rule-lit hover:bg-hull-lift",
  danger: "bg-transparent text-sev-crit border border-sev-crit hover:bg-sev-crit/10",
};

export function Button({ variant = "ghost", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded px-3 py-2 font-data text-data",
        "transition-colors duration-[120ms] ease-out",
        "disabled:opacity-40 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
