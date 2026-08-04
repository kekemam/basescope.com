"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

/** Tabs controladas por estado (Radix), para dentro de painéis — distintas de components/ui/tabs.tsx (essas navegam por rota). */
export const PanelTabs = TabsPrimitive.Root;

export function PanelTabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return <TabsPrimitive.List className={cn("flex items-center gap-4 border-b border-border px-4", className)} {...props} />;
}

export function PanelTabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "h-9 flex items-center border-b-2 border-transparent font-data text-data text-fg-muted",
        "data-[state=active]:border-accent data-[state=active]:text-fg hover:text-fg outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}
