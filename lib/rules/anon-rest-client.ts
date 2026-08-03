import type { AnonRestClient } from "./types";

function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const total = header.split("/")[1];
  if (!total || total === "*") return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

/**
 * Implementação real do AnonRestClient contra o PostgREST de um projeto
 * Supabase. Usa sempre HEAD — nunca GET — para nunca receber corpo com
 * dados reais. Ver docs/rules-critical.md § ANON-001.
 */
export class SupabaseAnonRestClient implements AnonRestClient {
  constructor(
    private readonly projectRef: string,
    private readonly anonKey: string,
  ) {}

  async headCount(table: string): Promise<{ status: number; totalCount: number | null }> {
    const res = await fetch(
      `https://${this.projectRef}.supabase.co/rest/v1/${encodeURIComponent(table)}?select=*`,
      {
        method: "HEAD",
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
        signal: AbortSignal.timeout(3000),
      },
    );
    return { status: res.status, totalCount: parseContentRangeTotal(res.headers.get("content-range")) };
  }

  async headStorageObject(bucket: string, path: string): Promise<{ status: number; contentLength: number | null }> {
    const res = await fetch(
      `https://${this.projectRef}.supabase.co/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`,
      { method: "HEAD", signal: AbortSignal.timeout(3000) },
    );
    const len = res.headers.get("content-length");
    return { status: res.status, contentLength: len ? Number(len) : null };
  }
}
