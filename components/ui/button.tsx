import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-bg hover:bg-accent/90",
  ghost: "bg-transparent text-fg border border-border hover:border-border-str hover:bg-surface-2",
  danger: "bg-transparent text-crit border border-crit hover:bg-crit/10",
};

// docs/design-system-v2.md § 9 — altura de botão: 30px (sm), 34px (md).
const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-[30px] px-2",
  md: "h-[34px] px-3",
};

export function Button({ variant = "ghost", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-data text-data",
        "transition-colors duration-[120ms] ease-out",
        "disabled:opacity-40 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
