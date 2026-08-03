"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { triggerScan } from "./actions";

export function ScanButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() => startTransition(() => triggerScan(projectId))}
    >
      {pending ? "A correr scan…" : "Executar scan"}
    </Button>
  );
}
