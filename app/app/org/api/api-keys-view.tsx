"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { createApiKey, revokeApiKey } from "./actions";

export interface ApiKeyRow {
  id: string;
  name: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function ApiKeysView({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="px-6 py-6 max-w-2xl flex flex-col gap-6">
      <h1 className="font-display text-display-l text-fg">Chaves API</h1>

      {revealedKey && (
        <div className="border border-accent/40 bg-accent-bg/30 rounded-md p-3 flex flex-col gap-2">
          <p className="font-data text-body-sm text-fg">Guarda esta chave agora — não voltas a vê-la.</p>
          <CodeBlock code={revealedKey} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da chave (ex.: CI)" className="w-64" />
        <Button
          variant="primary"
          disabled={!name || pending}
          onClick={() =>
            startTransition(async () => {
              const key = await createApiKey(name);
              setRevealedKey(key);
              setName("");
              router.refresh();
            })
          }
        >
          Criar chave
        </Button>
      </div>

      {keys.length === 0 ? (
        <EmptyState title="Nenhuma chave API criada." />
      ) : (
        <table className="w-full border-collapse font-data text-data">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Nome</th>
              <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Criada</th>
              <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="h-9 border-b border-border">
                <td className="px-3 text-fg">{key.name}</td>
                <td className="px-3 text-fg-muted">{new Date(key.created_at).toLocaleDateString("pt-PT")}</td>
                <td className="px-3 text-fg-muted">{key.revoked_at ? "revogada" : "ativa"}</td>
                <td className="px-3 text-right">
                  {!key.revoked_at && (
                    <button
                      type="button"
                      className="font-data text-body-sm text-crit hover:underline"
                      onClick={async () => {
                        await revokeApiKey(key.id);
                        toast("Chave revogada");
                        router.refresh();
                      }}
                    >
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
