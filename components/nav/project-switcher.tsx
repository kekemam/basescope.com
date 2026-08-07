"use client";

import { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { ScoreBar } from "@/components/score-bar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { ProjectSummary } from "@/lib/data/projects";

const STATUS_DOT: Record<string, string> = {
  connected: "bg-accent",
  error: "bg-crit",
  revoked: "bg-crit",
  pending: "bg-fg-subtle",
};

export function ProjectSwitcher({ projects, current }: { projects: ProjectSummary[]; current?: ProjectSummary }) {
  const [query, setQuery] = useState("");
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <DropdownMenu.Root onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border-str bg-surface pl-2.5 pr-2 h-8 font-prosa text-body-sm text-fg hover:bg-surface-2 shrink-0"
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[current?.connection_status ?? ""] ?? "bg-fg-subtle")}
            aria-hidden="true"
          />
          <span className="truncate max-w-[160px]">{current?.name ?? "Selecionar projeto"}</span>
          <ChevronDown size={14} className="text-fg-subtle shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 w-64 border border-border-str bg-overlay rounded-md shadow-lg py-1"
        >
          <div className="px-2 py-1">
            <Input
              autoFocus
              placeholder="Pesquisar projeto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((project) => (
              <DropdownMenu.Item key={project.id} asChild>
                <Link
                  href={`/app/p/${project.id}`}
                  className="flex items-center justify-between gap-2 px-3 h-9 font-data text-data text-fg hover:bg-surface-2 outline-none cursor-pointer"
                >
                  <span className="truncate">{project.name}</span>
                  <ScoreBar score={project.current_score ?? 0} />
                </Link>
              </DropdownMenu.Item>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 font-data text-body-sm text-fg-subtle">Nenhum projeto encontrado.</p>
            )}
          </div>

          <div className="border-t border-border py-1">
            <DropdownMenu.Item asChild>
              <Link
                href="/app/projects/new"
                className="flex items-center gap-2 px-3 h-9 font-data text-data text-accent hover:bg-surface-2 outline-none cursor-pointer"
              >
                + ligar projeto
              </Link>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
