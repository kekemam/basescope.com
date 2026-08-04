"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-border-str bg-surface data-[state=checked]:bg-accent data-[state=checked]:border-accent flex items-center justify-center",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-bg text-[11px] leading-none">✓</CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
