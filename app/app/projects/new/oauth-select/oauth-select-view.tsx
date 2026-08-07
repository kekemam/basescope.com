"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectOauthProject, type OauthSelectState } from "./actions";
import type { ManagementProject } from "@/lib/oauth/supabase";

const initialState: OauthSelectState = { status: "idle" };

export function OauthSelectView({ projects }: { projects: ManagementProject[] }) {
  const [state, formAction, pending] = useActionState(selectOauthProject, initialState);
  const [selectedRef, setSelectedRef] = useState(projects[0]?.ref ?? "");
  const selected = projects.find((p) => p.ref === selectedRef) ?? projects[0]!;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-data text-label uppercase tracking-[0.12em] text-fg-subtle">Projeto</span>
        <select
          value={selectedRef}
          onChange={(e) => setSelectedRef(e.target.value)}
          className="h-[34px] rounded-sm border border-border-str bg-surface px-2 font-data text-data text-fg"
        >
          {projects.map((p) => (
            <option key={p.ref} value={p.ref}>
              {p.name} ({p.ref}, {p.region})
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="projectRef" value={selected.ref} />
      <input type="hidden" name="projectName" value={selected.name} />
      <input type="hidden" name="region" value={selected.region} />

      <label className="flex flex-col gap-1">
        <span className="font-data text-label uppercase tracking-[0.12em] text-fg-subtle">Connection string</span>
        <Input
          name="connectionString"
          type="password"
          placeholder="postgresql://postgres.xxxx:senha@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
          required
        />
        <span className="font-prosa text-body-sm text-fg-muted">
          O OAuth prova que és dono do projeto e dá acesso à configuração via API, mas a Supabase nunca devolve a
          password da base de dados por API — precisamos dela para ler o catálogo (pg_policies, pg_class).
          Settings → Database → Connection string, modo pooler.
        </span>
      </label>

      {state.status === "error" && <p className="font-data text-data text-crit">{state.message}</p>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "A ligar…" : "Ligar projeto"}
      </Button>
    </form>
  );
}
