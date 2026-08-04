"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Botão copiar aparece no hover — docs/design-system-v2.md § 4. Sem realce de sintaxe: é SQL curto, não vale a dependência. */
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={cn("group relative border border-border bg-surface rounded-md", className)}>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-sm border border-border-str bg-overlay px-2 h-6 font-data text-body-sm text-fg-muted hover:text-fg"
      >
        {copied ? "copiado" : "⧉"}
      </button>
      <pre className="overflow-x-auto p-3 font-data text-data text-fg whitespace-pre">{code}</pre>
    </div>
  );
}
