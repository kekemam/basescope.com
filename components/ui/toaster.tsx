"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Canto inferior direito, 4s — docs/design-system-v2.md § 4. Estilo via CSS vars, sem tema por defeito do sonner. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      duration={4000}
      toastOptions={{
        style: {
          background: "var(--overlay)",
          border: "1px solid var(--border-str)",
          color: "var(--fg)",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-ibm-plex-mono)",
          fontSize: "13px",
        },
      }}
    />
  );
}
