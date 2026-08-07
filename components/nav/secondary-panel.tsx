"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldAlert, History, ListChecks, Settings, CreditCard, Users, KeyRound } from "lucide-react";
import { cn } from "@/lib/cn";

// Ícones de componentes React não são serializáveis entre Server e Client
// Components — o layout do projeto (Server Component) só pode passar a
// CHAVE (string); a resolução para o componente lucide real acontece aqui
// dentro, já em client.
const ICONS = {
  dashboard: LayoutDashboard,
  achados: ShieldAlert,
  historico: History,
  regras: ListChecks,
  definicoes: Settings,
  faturacao: CreditCard,
  equipa: Users,
  api: KeyRound,
} as const;

export type NavIconKey = keyof typeof ICONS;

export interface NavSection {
  title: string;
  items: Array<{ href: string; label: string; icon?: NavIconKey }>;
}

const STORAGE_KEY = "basescope:secondary-panel-collapsed";

/** Painel de 220px, colapsável, estado persistido. */
export function SecondaryPanel({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (collapsed) {
    return (
      <div className="w-8 shrink-0 border-r border-border bg-bg flex justify-center pt-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Expandir painel de navegação"
          className="h-6 w-6 flex items-center justify-center rounded-sm text-fg-muted hover:text-fg hover:bg-surface-2"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="w-[220px] shrink-0 border-r border-border bg-bg flex flex-col">
      <div className="flex justify-end px-2 pt-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Colapsar painel de navegação"
          className="h-6 w-6 flex items-center justify-center rounded-sm text-fg-muted hover:text-fg hover:bg-surface-2"
        >
          «
        </button>
      </div>
      <nav className="flex flex-col gap-5 px-2 pb-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              {section.title}
            </p>
            <div className="flex flex-col">
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon ? ICONS[item.icon] : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-2 h-9 flex items-center gap-2.5 font-prosa text-body-sm",
                      active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2",
                    )}
                  >
                    {Icon && <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : ""} />}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
