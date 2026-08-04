"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificationTokenForProject } from "@/lib/crypto/encrypt";

export interface VerifyState {
  status: "idle" | "error";
  message?: string;
}

const AGREEMENT_VERSION = "2026-08-03";

/**
 * O único caminho no código que pode gravar `ownership_verified_at`. Busca
 * o ficheiro well-known no domínio que o utilizador reclamou como seu e só
 * confirma a posse se o token esperado lá estiver — ver a regra
 * inegociável da secção 0 do PROJECT_SPEC.
 */
export async function verifyOwnership(projectId: string, _prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const agreementChecked = formData.get("agreement") === "on";
  if (!agreementChecked) {
    return { status: "error", message: "Tens de aceitar o Scan Authorization Agreement para continuar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, verified_domain")
    .eq("id", projectId)
    .single();

  if (error || !project?.verified_domain) {
    return { status: "error", message: "Projeto não encontrado." };
  }

  const expectedToken = verificationTokenForProject(project.id);
  const fileUrl = `https://${project.verified_domain}/.well-known/basescope-verification.txt`;

  let fileContent: string;
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) {
      return { status: "error", message: `Não consegui aceder a ${fileUrl} (HTTP ${res.status}).` };
    }
    fileContent = await res.text();
  } catch {
    return { status: "error", message: `Não consegui aceder a ${fileUrl}.` };
  }

  if (!fileContent.includes(expectedToken)) {
    return { status: "error", message: "O ficheiro existe mas o token não corresponde ao esperado." };
  }

  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({
      ownership_verified_at: new Date().toISOString(),
      verification_method: "file",
      connection_status: "connected",
    })
    .eq("id", project.id);

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const userAgent = requestHeaders.get("user-agent") ?? "";

  await supabase.from("scan_authorizations").insert({
    project_id: project.id,
    user_id: user.id,
    ip_address: ipAddress,
    user_agent: userAgent,
    agreement_version: AGREEMENT_VERSION,
  });

  redirect(`/app/p/${project.id}/achados`);
}
