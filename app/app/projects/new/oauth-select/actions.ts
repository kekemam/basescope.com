"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials } from "@/lib/crypto/encrypt";
import { bufferToPostgresBytea } from "@/lib/supabase/bytea";
import { getProjectAnonKey } from "@/lib/oauth/supabase";
import { decodeCookiePayload, SESSION_COOKIE } from "@/lib/oauth/cookie";
import type { OAuthTokens } from "@/lib/oauth/supabase";

export interface OauthSelectState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Cria o projeto já com `ownership_verified_at` — a autorização OAuth em si
 * é a prova de propriedade (PROJECT_SPEC § 0, caminho 1), ao contrário do
 * fluxo manual que exige o passo extra do ficheiro well-known. A anon key
 * é obtida automaticamente via Management API; a connection string continua
 * a ter de ser colada — a Management API nunca devolve a password da BD.
 */
export async function selectOauthProject(_prev: OauthSelectState, formData: FormData): Promise<OauthSelectState> {
  const projectRef = String(formData.get("projectRef") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const connectionString = String(formData.get("connectionString") ?? "").trim();

  if (!projectRef || !projectName || !connectionString) {
    return { status: "error", message: "Falta a connection string." };
  }

  const cookieStore = await cookies();
  const sessionRaw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionRaw) {
    return { status: "error", message: "Sessão OAuth expirada — tenta ligar de novo." };
  }
  const tokens = decodeCookiePayload<OAuthTokens>(sessionRaw);

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
  if (!membership) return { status: "error", message: "Não foi possível determinar a tua organização." };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ org_id: membership.org_id, name: projectName, provider: "supabase", project_ref: projectRef, region })
    .select("id")
    .single();
  if (projectError || !project) {
    return { status: "error", message: projectError?.message ?? "Falha ao criar o projeto." };
  }

  const anonKey = (await getProjectAnonKey(tokens.accessToken, projectRef)) ?? "";

  const encrypted = encryptCredentials(
    JSON.stringify({
      connectionString,
      anonKey,
      oauthAccessToken: tokens.accessToken,
      oauthRefreshToken: tokens.refreshToken,
      oauthExpiresAt: tokens.expiresAt,
    }),
  );

  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({
      encrypted_credentials: bufferToPostgresBytea(encrypted),
      ownership_verified_at: new Date().toISOString(),
      verification_method: "oauth",
      connection_status: "connected",
    })
    .eq("id", project.id);

  cookieStore.delete(SESSION_COOKIE);
  redirect(`/app/p/${project.id}/achados`);
}
