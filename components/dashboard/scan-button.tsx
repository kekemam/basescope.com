"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { triggerScan } from "@/app/app/p/[id]/actions";

/** Mesmo triggerScan da página de achados (docs em app/app/p/[id]/actions.ts) — redireciona para /achados no fim, onde os resultados aparecem. */
export function DashboardScanButton({ projectId }: { projectId: string }) {
  const [scanning, startScan] = useTransition();

  return (
    <Button variant="primary" disabled={scanning} onClick={() => startScan(() => triggerScan(projectId))}>
      {scanning ? "A correr scan…" : "Executar scan agora"}
    </Button>
  );
}
