"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials } from "@/lib/crypto/encrypt";
import { bufferToPostgresBytea } from "@/lib/supabase/bytea";

export interface ConnectProjectState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Cria o projeto em estado "pending" — NUNCA marca `ownership_verified_at`
 * aqui. A regra inegociável da secção 0 do PROJECT_SPEC exige prova real de
 * propriedade (ficheiro well-known), que só acontece em
 * app/app/p/[id]/verify/actions.ts depois deste passo. Sem isso,
 * qualquer pessoa podia colar credenciais de um projeto que não é dela.
 *
 * Credenciais guardadas: connection string direta (para o motor de regras
 * ler o catálogo pg_class/pg_policies/pg_proc) + anon key (para as sondas
 * HEAD do ANON-001), no mesmo blob AES-256-GCM.
 */
export async function connectProject(_prev: ConnectProjectState, formData: FormData): Promise<ConnectProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const projectRef = String(formData.get("projectRef") ?? "").trim();
  const connectionString = String(formData.get("connectionString") ?? "").trim();
  const anonKey = String(formData.get("anonKey") ?? "").trim();
  const domain = String(formData.get("domain") ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  if (!name || !projectRef || !connectionString || !anonKey || !domain) {
    return { status: "error", message: "Preenche todos os campos, incluindo o domínio da tua app." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) {
    return { status: "error", message: "Não foi possível determinar a tua organização." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ org_id: membership.org_id, name, provider: "supabase", project_ref: projectRef })
    .select("id")
    .single();

  if (projectError || !project) {
    return { status: "error", message: projectError?.message ?? "Falha ao criar o projeto." };
  }

  const encrypted = encryptCredentials(JSON.stringify({ connectionString, anonKey }));

  // encrypted_credentials e verified_domain não são graváveis por
  // `authenticated` além do que a policy/coluna já permite — usa-se o
  // admin client, já depois do INSERT ter passado pela RLS normal do dono.
  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({ encrypted_credentials: bufferToPostgresBytea(encrypted), verified_domain: domain })
    .eq("id", project.id);

  redirect(`/app/p/${project.id}/verify`);
}
