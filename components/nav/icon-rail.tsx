"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

interface RailItem {
  href: string;
  glyph: string;
  label: string;
}

const ITEMS: RailItem[] = [
  { href: "/app", glyph: "▣", label: "Visão geral" },
  { href: "/app/p", glyph: "◫", label: "Relatório" },
  { href: "/app/alertas", glyph: "⚑", label: "Alertas" },
  { href: "/app/historico", glyph: "⏱", label: "Histórico" },
  { href: "/app/definicoes", glyph: "⚙", label: "Definições" },
  { href: "/docs", glyph: "⌾", label: "Documentação" },
];

/** Rail de 48px, sempre visível — docs/design-system-v2.md § 3. */
export function IconRail() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-bg py-3 gap-1">
        <Link href="/app" className="mb-2">
          <Logo withWordmark={false} />
        </Link>

        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-sm font-data text-data",
                    active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2",
                  )}
                >
                  {active && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent" aria-hidden="true" />}
                  {item.glyph}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
