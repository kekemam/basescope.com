"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { VerifyState } from "./actions";

const initialState: VerifyState = { status: "idle" };

export function VerifyForm({ action }: { action: (prev: VerifyState, formData: FormData) => Promise<VerifyState> }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start gap-2 font-prosa text-body text-bone">
        <input type="checkbox" name="agreement" required className="mt-1" />
        <span>
          Aceito o{" "}
          <a href="/legal/scan-authorization" className="text-signal hover:underline">
            Scan Authorization Agreement
          </a>{" "}
          — confirmo que sou o proprietário deste projeto e autorizo o Basescope a analisar a sua configuração
          de segurança.
        </span>
      </label>

      {state.status === "error" && <p className="font-data text-data text-sev-crit">{state.message}</p>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "A verificar…" : "Verificar e autorizar scan"}
      </Button>
    </form>
  );
}
