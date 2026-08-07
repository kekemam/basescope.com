"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_LABELS: Record<string, string> = {
  "": "Dashboard",
  achados: "Achados",
  historico: "Histórico",
  regras: "Regras",
  definicoes: "Definições",
  verify: "Verificação",
};

/** "Organização / {org} / {projeto} / {página}" — mesma estrutura da interface de referência. Cliente porque precisa do pathname para saber em que página está. */
export function ProjectBreadcrumbs({
  projectId,
  projectName,
  orgName,
}: {
  projectId: string;
  projectName: string;
  orgName: string;
}) {
  const pathname = usePathname();
  const rest = pathname.replace(`/app/p/${projectId}`, "").replace(/^\//, "");
  const segment = rest.split("/")[0] ?? "";
  const pageLabel = PAGE_LABELS[segment] ?? "Dashboard";

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 font-data text-body-sm min-w-0">
      <span className="text-fg-subtle whitespace-nowrap">Organização</span>
      <span className="text-fg-subtle">/</span>
      <span className="text-fg-subtle whitespace-nowrap">{orgName}</span>
      <span className="text-fg-subtle">/</span>
      <Link href={`/app/p/${projectId}`} className="text-fg-muted hover:text-fg whitespace-nowrap truncate">
        {projectName}
      </Link>
      <span className="text-fg-subtle">/</span>
      <span className="text-fg whitespace-nowrap">{pageLabel}</span>
    </nav>
  );
}
