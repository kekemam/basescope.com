"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { verifyFixes } from "./verify-fixes-action";

export function VerifyFixesButton({ projectId, scanId }: { projectId: string; scanId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await verifyFixes(projectId, scanId);
          router.refresh();
        })
      }
    >
      {pending ? "A verificar…" : "Verificar correções"}
    </Button>
  );
}
