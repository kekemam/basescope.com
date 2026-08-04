"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/cn";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex items-center gap-2 rounded-sm border border-border bg-surface px-2 h-[34px] font-data text-data text-fg outline-none focus-visible:shadow-focus",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-fg-subtle">▾</SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn("z-50 border border-border-str bg-overlay rounded-md shadow-lg py-1", className)}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "flex items-center px-3 h-8 font-data text-data text-fg hover:bg-surface-2 outline-none cursor-pointer data-[state=checked]:text-accent",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
