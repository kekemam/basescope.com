"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavSection {
  title: string;
  items: Array<{ href: string; label: string }>;
}

const STORAGE_KEY = "basescope:secondary-panel-collapsed";

/** Painel de 220px, colapsável, estado persistido — docs/design-system-v2.md § 3. */
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
      <nav className="flex flex-col gap-4 px-2 pb-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2 mb-1 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              {section.title}
            </p>
            <div className="flex flex-col">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-sm px-2 h-8 flex items-center font-data text-data",
                      active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2",
                    )}
                  >
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
