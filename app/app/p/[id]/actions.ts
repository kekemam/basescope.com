"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runScanAndPersist } from "@/lib/scan/execute";

/**
 * Dispara um scan síncrono, dentro do próprio request (cabe no maxDuration
 * de 60s da function — ver secção 2 do PROJECT_SPEC). A linha inicial de
 * `scans` é inserida aqui com o client autenticado (não o admin) para a
 * policy `scans_insert_own_org_authorized` (0003/0007) aplicar verificação
 * de propriedade + quota do plano — runScanAndPersist trata do resto
 * (correr regras, gravar achados, notificar) com o admin client. O
 * caminho agendado (Fase 4, app/api/cron/process-scan-jobs) usa
 * executeScheduledScan em vez deste, porque não há sessão de browser num
 * cron job.
 */
export async function triggerScan(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({ project_id: projectId, status: "running", started_at: new Date().toISOString(), trigger: "manual" })
    .select("id")
    .single();

  if (scanError || !scan) {
    throw new Error(scanError?.message ?? "Não foi possível iniciar o scan — falta autorização ou verificação.");
  }

  await runScanAndPersist(scan.id, projectId, "manual");

  redirect(`/app/p/${projectId}/achados`);
}
