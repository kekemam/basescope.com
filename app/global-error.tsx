"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Só dispara para erros de renderização não apanhados por um error.tsx local — substitui o root layout inteiro, por isso traz o próprio <html>/<body>. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-PT" data-theme="dark">
      <body style={{ background: "#131619", color: "#ededed", fontFamily: "ui-monospace, monospace" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", padding: "24px", textAlign: "center" }}>
          <p style={{ fontSize: "14px" }}>Algo correu mal. Já fomos notificados.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#4c9ef5", color: "#0b1220", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: "pointer" }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
