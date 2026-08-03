"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestSignup, type SignupState } from "./actions";

const initialState: SignupState = { status: "idle" };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(requestSignup, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm border border-rule bg-hull p-6">
        <h1 className="font-display text-display-l text-bone mb-1">Basescope</h1>
        <p className="font-prosa text-body text-graphite mb-6">
          Descobre em 90 segundos se a tua app expõe dados.
        </p>

        {state.status === "sent" ? (
          <p className="font-data text-data text-sev-ok">{state.message}</p>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-data text-label uppercase tracking-[0.12em] text-graphite">Organização</span>
              <Input name="orgName" placeholder="A tua empresa" required autoComplete="organization" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-data text-label uppercase tracking-[0.12em] text-graphite">Email</span>
              <Input name="email" type="email" placeholder="tu@empresa.com" required autoComplete="email" />
            </label>

            {state.status === "error" && <p className="font-data text-data text-sev-crit">{state.message}</p>}

            <Button type="submit" variant="primary" disabled={pending} className="mt-2">
              {pending ? "A enviar…" : "Criar conta"}
            </Button>
          </form>
        )}

        <p className="font-data text-body-sm text-graphite mt-6">
          Já tens conta? <a href="/login" className="text-signal hover:underline">Entrar</a>
        </p>
      </div>
    </main>
  );
}
