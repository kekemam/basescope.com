"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectProject, type ConnectProjectState } from "./actions";

const initialState: ConnectProjectState = { status: "idle" };

export default function NewProjectPage() {
  const [state, formAction, pending] = useActionState(connectProject, initialState);

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-display-l text-bone mb-1">Ligar projeto Supabase</h1>
      <p className="font-prosa text-body text-graphite mb-6">
        Vamos pedir a connection string e a anon key. Nunca guardamos a tua service_role key.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Nome do projeto">
          <Input name="name" placeholder="buildflow-prod" required />
        </Field>

        <Field label="Project ref">
          <Input name="projectRef" placeholder="hxjsfwkjqskcjedhlgmv" required />
        </Field>

        <Field label="Connection string" hint="Settings → Database → Connection string (modo pooler, porta 6543)">
          <Input
            name="connectionString"
            type="password"
            placeholder="postgresql://postgres.xxxx:senha@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
            required
          />
        </Field>

        <Field label="Anon key" hint="Settings → API → Project API keys → anon public">
          <Input name="anonKey" type="password" placeholder="eyJhbGciOi..." required />
        </Field>

        <Field
          label="Domínio da tua app"
          hint="Usado para provar que o projeto é teu e para as regras CLIENT-001/002"
        >
          <Input name="domain" placeholder="app.exemplo.com" required />
        </Field>

        {state.status === "error" && <p className="font-data text-data text-sev-crit">{state.message}</p>}

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "A ligar…" : "Continuar para verificação"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-data text-label uppercase tracking-[0.12em] text-graphite">{label}</span>
      {children}
      {hint && <span className="font-prosa text-body-sm text-graphite">{hint}</span>}
    </label>
  );
}
