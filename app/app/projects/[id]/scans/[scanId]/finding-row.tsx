"use client";

import { useState } from "react";
import { SeverityBar } from "@/components/severity-bar";
import type { Severity } from "@/lib/rules/types";

export interface FindingViewModel {
  id: string;
  ruleId: string;
  severity: Severity;
  resourceName: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  remediationSql: string | null;
  status: string;
}

export function FindingRow({ finding, mode }: { finding: FindingViewModel; mode: "plain" | "technical" }) {
  const [open, setOpen] = useState(false);
  const status = finding.status === "open" ? "ABERTO" : finding.status.toUpperCase();

  return (
    <div className="border-b border-rule">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-2 py-3 text-left hover:bg-hull-lift"
      >
        <SeverityBar status={finding.severity} showLabel={false} />
        <span className="w-24 shrink-0 font-data text-data text-bone">{finding.ruleId}</span>
        <span className="flex-1 font-data text-data text-bone truncate">{finding.resourceName}</span>
        <span className="w-20 shrink-0 font-data text-label uppercase tracking-[0.12em] text-graphite text-right">
          {status}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-4 pl-[calc(1.5rem+6rem)] flex flex-col gap-3">
          {mode === "plain" ? (
            <p className="font-prosa text-body text-bone">{finding.description}</p>
          ) : (
            <pre className="font-data text-data text-bone whitespace-pre-wrap">
              {JSON.stringify(finding.evidence, null, 2)}
            </pre>
          )}

          {finding.remediationSql && (
            <div>
              <p className="font-data text-label uppercase tracking-[0.12em] text-graphite mb-1">SQL de correção</p>
              <pre className="border border-rule bg-hull p-3 font-data text-data text-bone overflow-x-auto">
                {finding.remediationSql}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
