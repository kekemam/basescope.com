import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";

export default async function EquipaPage() {
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("memberships").select("id, role, user_id");

  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-display-l text-fg mb-6">Equipa</h1>

      {memberships && memberships.length > 0 ? (
        <table className="w-full border-collapse font-data text-data max-w-xl">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Utilizador</th>
              <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Papel</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="h-9 border-b border-border">
                <td className="px-3 text-fg font-mono text-body-sm">{m.user_id}</td>
                <td className="px-3 text-fg-muted">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="Sem membros." />
      )}

      <p className="font-prosa text-body-sm text-fg-subtle mt-6 max-w-md">
        Convites por email ainda não estão disponíveis — por agora a gestão de papéis faz-se diretamente na base de
        dados.
      </p>
    </div>
  );
}
