import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeScheduledScan } from "@/lib/scan/execute";

// Um scan cabe em ~45s (lib/scan/run-scan.ts) — 60s dá margem para o resto
// do processamento deste job.
export const maxDuration = 60;

interface ClaimedJob {
  id: string;
  project_id: string;
}

/**
 * Chamado por pg_net a cada 5min (migração 0008_scheduled_scans.sql,
 * cron job "basescope-process-scan-jobs") — nunca pelo browser. Reclama UM
 * job de scan_jobs via claim_next_scan_job() (FOR UPDATE SKIP LOCKED,
 * impossível de expressar num SELECT normal via PostgREST) e corre o scan
 * a sério. Um job por invocação, para caber confortavelmente no
 * maxDuration — com o cron a correr de 5 em 5 minutos isto dá até 12
 * scans/hora, mais do que suficiente para o volume atual.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc("claim_next_scan_job");
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const job = (claimed as ClaimedJob[] | null)?.[0];
  if (!job) return NextResponse.json({ processed: 0 });

  try {
    const result = await executeScheduledScan(job.project_id);
    await admin
      .from("scan_jobs")
      .update({ status: result.status === "failed" ? "failed" : "done", finished_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ processed: 1, projectId: job.project_id, status: result.status });
  } catch (err) {
    await admin
      .from("scan_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : "Erro desconhecido",
      })
      .eq("id", job.id);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}
