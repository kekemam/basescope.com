"use server";

import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function createApiKey(name: string): Promise<string> {
  const supabase = await createClient();

  const { data: membership } = await supabase.from("memberships").select("org_id").limit(1).single();
  if (!membership) throw new Error("Sem organização associada.");

  const rawKey = `bsk_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  await supabase.from("api_keys").insert({ org_id: membership.org_id, name, key_hash: keyHash });

  return rawKey; // devolvida uma única vez — nunca fica legível depois disto
}

export async function revokeApiKey(keyId: string) {
  const supabase = await createClient();
  await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId);
}
