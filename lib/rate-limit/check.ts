import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiter em janela deslizante, apoiado em Postgres em vez de
 * Redis/Upstash (PROJECT_SPEC § 9) — mesma filosofia de scan_jobs. Não é
 * atómico entre o delete/count/insert, o que sob concorrência alta pode
 * deixar passar 1-2 pedidos a mais; aceitável para travar abuso, não para
 * cobrança exata.
 */
export async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean }> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  await admin.from("rate_limit_events").delete().eq("bucket_key", bucketKey).lt("created_at", windowStart);

  const { count } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucketKey);

  if ((count ?? 0) >= limit) return { allowed: false };

  await admin.from("rate_limit_events").insert({ bucket_key: bucketKey });
  return { allowed: true };
}
