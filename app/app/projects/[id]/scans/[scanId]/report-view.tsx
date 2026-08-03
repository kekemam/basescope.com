"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { FindingRow, type FindingViewModel } from "./finding-row";

export function ReportView({ findings }: { findings: FindingViewModel[] }) {
  const [mode, setMode] = useState<"plain" | "technical">("plain");

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-4 font-data text-label uppercase tracking-[0.12em]">
        <button
          type="button"
          onClick={() => setMode("plain")}
          className={cn("px-2 py-1", mode === "plain" ? "text-signal" : "text-graphite hover:text-bone")}
        >
          PLAIN
        </button>
        <span className="text-rule">▸</span>
        <button
          type="button"
          onClick={() => setMode("technical")}
          className={cn("px-2 py-1", mode === "technical" ? "text-signal" : "text-graphite hover:text-bone")}
        >
          TECHNICAL
        </button>
      </div>

      {findings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="font-data text-display-l text-sev-ok" aria-hidden="true">
            ████
          </span>
          <p className="font-prosa text-body text-bone">Sem achados em aberto.</p>
        </div>
      ) : (
        <div className="border-t border-rule">
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}
