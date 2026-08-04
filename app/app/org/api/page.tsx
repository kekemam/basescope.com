import { createClient } from "@/lib/supabase/server";
import { ApiKeysView } from "./api-keys-view";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, last_used_at, revoked_at, created_at")
    .order("created_at", { ascending: false });

  return <ApiKeysView keys={keys ?? []} />;
}
