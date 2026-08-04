import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-sm bg-surface border border-border px-2 h-[34px] font-data text-data text-fg",
        "placeholder:text-fg-subtle",
        "focus-visible:outline-none focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
});
