"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import { toast } from "sonner";
import { ScoreBar } from "@/components/score-bar";
import type { ProjectSummary } from "@/lib/data/projects";
import { searchProjectFindings, type FindingSearchResult } from "@/lib/data/command-menu";
import { triggerScan } from "@/app/app/p/[id]/actions";
import { verifyFixes } from "@/app/app/p/[id]/achados/actions";
import { buildCombinedSqlScript } from "@/lib/rules/combine-sql";

const PROJECT_ID_PATTERN = /^\/app\/p\/([^/]+)/;

/**
 * Cmd+K global — docs/design-system-v2.md § 5. Monta-se uma vez no layout
 * de /app; deteta o projeto atual pelo pathname para mostrar ações e
 * achados relevantes só quando fazem sentido.
 */
export function CommandMenu({ projects }: { projects: ProjectSummary[] }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<FindingSearchResult[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const currentProjectId = PROJECT_ID_PATTERN.exec(pathname)?.[1] ?? null;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && currentProjectId) {
        e.preventDefault();
        triggerScan(currentProjectId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentProjectId]);

  useEffect(() => {
    if (open && currentProjectId) {
      searchProjectFindings(currentProjectId).then(setFindings);
    } else {
      setFindings([]);
    }
  }, [open, currentProjectId]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-md border border-border-str bg-overlay shadow-lg"
    >
      <Command.Input
        placeholder="Pesquisar ações, projetos, achados…"
        className="w-full border-b border-border bg-transparent px-4 h-11 font-data text-data text-fg outline-none placeholder:text-fg-subtle"
      />
      <Command.List className="max-h-96 overflow-y-auto p-2">
        <Command.Empty className="px-2 py-4 font-data text-body-sm text-fg-subtle">Sem resultados.</Command.Empty>

        {currentProjectId && (
          <Command.Group heading="Ações" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-data [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
            <Command.Item
              onSelect={() => {
                setOpen(false);
                triggerScan(currentProjectId);
              }}
              className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer"
            >
              Executar scan agora
            </Command.Item>
            <Command.Item
              onSelect={() => {
                setOpen(false);
                verifyFixes(currentProjectId).then(() => router.refresh());
              }}
              className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer"
            >
              Verificar correções
            </Command.Item>
            {findings.some((f) => f.severity === "critical") && (
              <Command.Item
                onSelect={() => {
                  setOpen(false);
                  const critical = findings.filter((f) => f.severity === "critical");
                  navigator.clipboard.writeText(buildCombinedSqlScript(critical));
                  toast("SQL copiado");
                }}
                className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer"
              >
                Copiar todo o SQL de correção
              </Command.Item>
            )}
          </Command.Group>
        )}

        <Command.Group heading="Ir para" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-data [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
          {currentProjectId ? (
            <>
              <Command.Item onSelect={() => go(`/app/p/${currentProjectId}/achados`)} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
                Achados
              </Command.Item>
              <Command.Item onSelect={() => go(`/app/p/${currentProjectId}/historico`)} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
                Histórico
              </Command.Item>
              <Command.Item onSelect={() => go(`/app/p/${currentProjectId}/regras`)} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
                Regras
              </Command.Item>
              <Command.Item onSelect={() => go(`/app/p/${currentProjectId}/definicoes`)} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
                Definições
              </Command.Item>
            </>
          ) : null}
          <Command.Item onSelect={() => go("/app/org/faturacao")} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
            Faturação
          </Command.Item>
          <Command.Item onSelect={() => go("/app/org/equipa")} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
            Equipa
          </Command.Item>
          <Command.Item onSelect={() => go("/app/org/api")} className="flex items-center px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer">
            Chaves API
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Projetos" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-data [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
          {projects.map((project) => (
            <Command.Item
              key={project.id}
              value={project.name}
              onSelect={() => go(`/app/p/${project.id}`)}
              className="flex items-center justify-between px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer"
            >
              <span className="truncate">{project.name}</span>
              <ScoreBar score={project.current_score ?? 0} />
            </Command.Item>
          ))}
        </Command.Group>

        {findings.length > 0 && (
          <Command.Group heading="Achados" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-data [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
            {findings.map((f) => (
              <Command.Item
                key={f.id}
                value={`${f.ruleId} ${f.resourceName}`}
                onSelect={() => currentProjectId && go(`/app/p/${currentProjectId}/achados`)}
                className="flex items-center gap-2 px-2 h-9 rounded-sm font-data text-data text-fg data-[selected=true]:bg-surface-2 cursor-pointer"
              >
                <span className="text-fg-muted">{f.ruleId}</span>
                <span className="truncate">{f.resourceName}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {currentProject && (
          <p className="px-2 pt-2 font-data text-body-sm text-fg-subtle">
            Contexto atual: {currentProject.name}
          </p>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
