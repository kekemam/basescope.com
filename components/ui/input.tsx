import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded bg-hull border border-rule px-3 py-2 font-data text-data text-bone",
        "placeholder:text-slate",
        "focus-visible:outline-none focus-visible:shadow-focus",
        className,
      )}
      {...props}
    />
  );
}
