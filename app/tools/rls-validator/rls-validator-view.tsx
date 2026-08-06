"use client";

import { useMemo, useState } from "react";
import { analyzePolicySql, type ValidatorFinding } from "@/lib/validator/analyze-policy";

const PLACEHOLDER = `create policy "orders_select_own" on public.orders
for select
to authenticated
using (auth.uid() = user_id);`;

const SEVERITY_VAR: Record<string, string> = {
  critical: "var(--crit)",
  high: "var(--high)",
  medium: "var(--med)",
  low: "var(--low)",
  info: "var(--fg-subtle)",
};

function FindingCard({ finding }: { finding: ValidatorFinding }) {
  return (
    <div className="border border-border rounded-md bg-surface p-4">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="font-data text-body-sm uppercase tracking-[0.04em]"
          style={{ color: SEVERITY_VAR[finding.severity] }}
        >
          {finding.severity}
        </span>
      </div>
      <p className="font-data text-data text-fg mb-1">{finding.title}</p>
      <p className="font-prosa text-body-sm text-fg-muted">{finding.detail}</p>
    </div>
  );
}

/** Corre inteiramente no browser — o SQL colado nunca sai do cliente, nunca é enviado a um servidor. */
export function RlsValidatorView() {
  const [sql, setSql] = useState("");
  const findings = useMemo(() => analyzePolicySql(sql), [sql]);

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={10}
        spellCheck={false}
        className="w-full border border-border-str bg-surface rounded-md p-3 font-data text-data text-fg placeholder:text-fg-subtle resize-y focus-visible:outline-none focus-visible:shadow-focus"
      />
      <p className="font-data text-body-sm text-fg-subtle">
        Runs entirely in your browser — this SQL is never sent to a server.
      </p>

      {sql.trim() && (
        <div className="flex flex-col gap-3">
          {findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
