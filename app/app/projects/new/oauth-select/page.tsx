import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listManagementProjects } from "@/lib/oauth/supabase";
import { decodeCookiePayload, SESSION_COOKIE } from "@/lib/oauth/cookie";
import type { OAuthTokens } from "@/lib/oauth/supabase";
import { OauthSelectView } from "./oauth-select-view";

export default async function OauthSelectPage() {
  const cookieStore = await cookies();
  const sessionRaw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionRaw) redirect("/app/projects/new?oauth_error=session_expired");

  let tokens: OAuthTokens;
  try {
    tokens = decodeCookiePayload<OAuthTokens>(sessionRaw);
  } catch {
    redirect("/app/projects/new?oauth_error=session_expired");
  }

  const projects = await listManagementProjects(tokens.accessToken);

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-display-l text-fg mb-1">Escolhe o projeto</h1>
      <p className="font-prosa text-body text-fg-muted mb-6">
        Autorização Supabase confirmada — isto já conta como verificação de propriedade. Escolhe qual projeto ligar.
      </p>

      {projects.length === 0 ? (
        <p className="font-prosa text-body text-fg-muted">
          Não encontrámos nenhum projeto Supabase nesta conta. Confirma que autorizaste a organização certa.
        </p>
      ) : (
        <OauthSelectView projects={projects} />
      )}
    </div>
  );
}
