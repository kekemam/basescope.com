"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface TabItem {
  href: string;
  label: string;
}

/**
 * Navegação de segundo nível por rota (não Radix Tabs controlado por
 * estado) — cada tab é uma página própria, por isso liga-se ao pathname
 * em vez de gerir seleção em memória. Sublinhado de 2px — docs/design-system-v2.md § 3.
 */
export function Tabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <div role="tablist" className="flex items-center gap-4 border-b border-border px-4">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "h-9 flex items-center border-b-2 font-data text-data",
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
