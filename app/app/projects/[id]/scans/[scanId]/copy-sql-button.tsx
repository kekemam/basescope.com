"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FindingViewModel } from "./finding-row";

/**
 * Ordem heurística, não um grafo de dependências real: privilégios de
 * schema/extensões primeiro (GRANT, FN), depois RLS (RLS, PII),
 * depois storage — corrigir a política antes de a tabela ter RLS ativo
 * não faz sentido, por exemplo.
 */
const CATEGORY_ORDER = ["GRANT", "FN", "RLS", "PII", "VIEW", "STO", "AUTH", "EF"];

function categoryRank(ruleId: string): number {
  const prefix = ruleId.split("-")[0] ?? "";
  const index = CATEGORY_ORDER.indexOf(prefix);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function buildCombinedScript(findings: FindingViewModel[]): string {
  const withSql = findings
    .filter((f) => f.remediationSql)
    .sort((a, b) => categoryRank(a.ruleId) - categoryRank(b.ruleId));

  if (withSql.length === 0) return "-- Sem SQL de correção automática para os achados críticos.";

  const sections = withSql.map(
    (f) => `-- ${f.ruleId} · ${f.resourceName}\n-- ${f.title}\n${f.remediationSql}`,
  );

  return `-- Basescope · SQL de correção combinado\n-- Ordem heurística: schema/extensões → RLS → storage. Revê antes de correr.\n\n${sections.join("\n\n")}\n`;
}

export function CopySqlButton({ findings }: { findings: FindingViewModel[] }) {
  const [copied, setCopied] = useState(false);
  const criticalOpen = findings.filter((f) => f.severity === "critical" && f.status === "open");

  if (criticalOpen.length === 0) return null;

  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(buildCombinedScript(criticalOpen));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "SQL copiado" : `Copiar todo o SQL de correção (${criticalOpen.length})`}
    </Button>
  );
}
