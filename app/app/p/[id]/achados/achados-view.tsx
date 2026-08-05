"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { SeverityBar } from "@/components/severity-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, createSelectionColumn } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import type { FindingViewModel } from "./types";
import { FindingPanel } from "./finding-panel";
import { ignoreFindings, reopenFindings, verifyFixes } from "./actions";
import { triggerScan } from "../actions";
import { buildCombinedSqlScript } from "@/lib/rules/combine-sql";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["open", "fixed", "ignored"] as const;

const SORT_OPTIONS = [
  { value: "severity", label: "Severidade" },
  { value: "rule", label: "Regra" },
  { value: "resource", label: "Recurso" },
];

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function toggleInSet<T>(setFn: (updater: (prev: Set<T>) => Set<T>) => void, value: T) {
  setFn((prev) => {
    const next = new Set(prev);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}

export function AchadosView({
  projectId,
  findings,
  exposureConfirmed,
  isPaywalled,
}: {
  projectId: string;
  findings: FindingViewModel[];
  exposureConfirmed: FindingViewModel | null;
  isPaywalled: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(["open"]));
  const [sort, setSort] = useState("severity");
  const [mode, setMode] = useState<"plain" | "technical">("plain");
  const [activeFinding, setActiveFinding] = useState<FindingViewModel | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [scanning, startScan] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const criticalOpenCount = useMemo(
    () => findings.filter((f) => f.severity === "critical" && f.status === "open").length,
    [findings],
  );

  // Paywall (PROJECT_SPEC § 6.2): no Free, só os 3 primeiros críticos vêm
  // por inteiro — a ordem já chega ordenada por severidade da query.
  const unlockedIds = useMemo(() => {
    if (!isPaywalled) return null;
    return new Set(findings.filter((f) => f.severity === "critical").slice(0, 3).map((f) => f.id));
  }, [findings, isPaywalled]);
  const isLocked = (f: FindingViewModel) => unlockedIds !== null && !unlockedIds.has(f.id);
  const lockedCount = unlockedIds ? findings.filter((f) => isLocked(f)).length : 0;

  const filtered = useMemo(() => {
    let rows = findings;
    if (severityFilter.size > 0) rows = rows.filter((f) => severityFilter.has(f.severity));
    if (statusFilter.size > 0) rows = rows.filter((f) => statusFilter.has(f.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((f) => f.ruleId.toLowerCase().includes(q) || f.resourceName.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sort === "severity") return SEVERITY_RANK[a.severity]! - SEVERITY_RANK[b.severity]!;
      if (sort === "rule") return a.ruleId.localeCompare(b.ruleId);
      return a.resourceName.localeCompare(b.resourceName);
    });
  }, [findings, severityFilter, statusFilter, search, sort]);

  // j/k percorre achados, Enter abre, c copia SQL, i marca intencional, Esc fecha — docs/design-system-v2.md § 6.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        setActiveFinding(null);
        return;
      }

      const currentIndex = activeFinding ? filtered.findIndex((f) => f.id === activeFinding.id) : -1;

      if (e.key === "j") {
        // No plano Free, j/k salta os achados bloqueados em vez de abrir um
        // toast a cada tecla — só Enter numa linha bloqueada mostra o upsell.
        const next = filtered.slice(currentIndex + 1).find((f) => !isLocked(f));
        if (next) setActiveFinding(next);
      } else if (e.key === "k") {
        const prev = [...filtered.slice(0, Math.max(0, currentIndex))].reverse().find((f) => !isLocked(f));
        if (prev) setActiveFinding(prev);
      } else if (e.key === "Enter" && !activeFinding && filtered[0]) {
        openFinding(filtered[0]);
      } else if (e.key === "c" && activeFinding?.remediationSql) {
        navigator.clipboard.writeText(activeFinding.remediationSql);
      } else if (e.key === "i" && activeFinding) {
        ignoreFindings([activeFinding.id], "Isto é público de propósito").then(() => router.refresh());
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // isLocked/openFinding são recriadas a cada render mas dependem só de
    // `findings`/`isPaywalled`, já cobertos indiretamente por `filtered`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFinding, filtered, router]);

  const columns: ColumnDef<FindingViewModel>[] = [
    createSelectionColumn<FindingViewModel>(),
    {
      id: "severity",
      size: 100,
      header: "Severidade",
      cell: ({ row }) => <SeverityBar status={row.original.severity} showLabel={false} />,
    },
    {
      id: "rule",
      size: 96,
      header: "Regra",
      cell: ({ row }) => (isLocked(row.original) ? <span className="blur-sm select-none">XXX-000</span> : row.original.ruleId),
    },
    {
      id: "resource",
      header: "Recurso",
      cell: ({ row }) =>
        isLocked(row.original) ? (
          <span className="blur-sm select-none truncate block">████████████████</span>
        ) : (
          <span className="truncate block">{row.original.resourceName}</span>
        ),
    },
    {
      id: "status",
      size: 110,
      header: "Estado",
      cell: ({ row }) => <Badge status={row.original.status} />,
    },
  ];

  const chips = [
    ...[...severityFilter].map((s) => ({ key: `sev:${s}`, label: `severidade: ${s}` })),
    ...[...statusFilter].map((s) => ({ key: `status:${s}`, label: `estado: ${s}` })),
  ];

  function openFinding(f: FindingViewModel) {
    if (isLocked(f)) {
      toast("Achado bloqueado no plano Free", {
        action: { label: "Ver planos", onClick: () => router.push("/app/org/faturacao") },
      });
      return;
    }
    setActiveFinding(f);
  }

  function removeChip(key: string) {
    if (key.startsWith("sev:")) {
      const value = key.slice(4);
      setSeverityFilter((prev) => new Set([...prev].filter((v) => v !== value)));
    } else if (key.startsWith("status:")) {
      const value = key.slice(7);
      setStatusFilter((prev) => new Set([...prev].filter((v) => v !== value)));
    }
  }

  return (
    <div className="flex flex-col h-full">
      {exposureConfirmed && (
        <InlineBanner className="mx-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="font-data text-data text-crit uppercase tracking-[0.04em]">
              EXPOSIÇÃO CONFIRMADA · {exposureConfirmed.resourceName}
            </span>
            <Button variant="danger" onClick={() => openFinding(exposureConfirmed)}>
              Corrigir agora →
            </Button>
          </div>
        </InlineBanner>
      )}

      {lockedCount > 0 && (
        <InlineBanner tone="med" className="mx-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="font-data text-data text-med">
              {lockedCount} achado(s) bloqueado(s) no plano Free — só os 3 primeiros críticos ficam visíveis por inteiro.
            </span>
            <Link href="/app/org/faturacao">
              <Button variant="primary">Desbloquear {lockedCount} achados</Button>
            </Link>
          </div>
        </InlineBanner>
      )}

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-data text-label uppercase tracking-[0.08em]">
            {SEVERITIES.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-fg-subtle">·</span>}
                <button type="button" onClick={() => toggleInSet(setSeverityFilter, s)} className={severityFilter.has(s) ? "text-accent" : "text-fg-muted hover:text-fg"}>
                  {s}
                </button>
              </span>
            ))}
          </div>
          <span className="text-fg-subtle">|</span>
          <div className="flex items-center gap-2 font-data text-label uppercase tracking-[0.08em]">
            {STATUSES.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-fg-subtle">·</span>}
                <button type="button" onClick={() => toggleInSet(setStatusFilter, s)} className={statusFilter.has(s) ? "text-accent" : "text-fg-muted hover:text-fg"}>
                  {s}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode("plain")} className={mode === "plain" ? "text-accent" : "text-fg-muted"}>
            PLAIN
          </button>
          <span className="text-fg-subtle">▸</span>
          <button type="button" onClick={() => setMode("technical")} className={mode === "technical" ? "text-accent" : "text-fg-muted"}>
            TECHNICAL
          </button>
          <Button
            variant="ghost"
            disabled={verifying}
            onClick={async () => {
              setVerifying(true);
              await verifyFixes(projectId);
              setVerifying(false);
              toast("Correções verificadas");
              router.refresh();
            }}
          >
            {verifying ? "A verificar…" : "Verificar correções"}
          </Button>
          {criticalOpenCount > 0 && (
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(buildCombinedSqlScript(findings.filter((f) => f.severity === "critical" && f.status === "open")));
                toast("SQL copiado");
              }}
            >
              Copiar todo o SQL de correção ({criticalOpenCount})
            </Button>
          )}
          <Button
            variant="primary"
            disabled={scanning}
            onClick={() => startScan(() => triggerScan(projectId))}
          >
            {scanning ? "A correr scan…" : "Executar scan"}
          </Button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Pesquisar por regra ou recurso…"
        chips={chips}
        onRemoveChip={removeChip}
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        searchInputRef={searchInputRef}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={statusFilter.has("open") && statusFilter.size === 1 ? "Sem achados em aberto." : "Nada para mostrar com estes filtros."}
          description="Ajusta os filtros acima ou volta a correr um scan."
        />
      ) : (
        <div className="flex-1 min-h-0">
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(f) => f.id}
            onRowClick={openFinding}
            activeRowId={activeFinding?.id}
            bulkActions={(selected) => (
              <>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const ids = selected.map((f) => f.id);
                    await ignoreFindings(ids);
                    router.refresh();
                    toast(`${ids.length} achado(s) ignorado(s)`, {
                      action: {
                        label: "Desfazer",
                        onClick: async () => {
                          await reopenFindings(ids);
                          router.refresh();
                        },
                      },
                    });
                  }}
                >
                  Ignorar
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await reopenFindings(selected.map((f) => f.id));
                    router.refresh();
                    toast("Achados reabertos");
                  }}
                >
                  Reabrir
                </Button>
              </>
            )}
          />
        </div>
      )}

      <FindingPanel
        finding={activeFinding}
        mode={mode}
        onClose={() => setActiveFinding(null)}
        onIgnored={() => {
          setActiveFinding(null);
          router.refresh();
        }}
      />
    </div>
  );
}
