import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a service_role key do próprio Basescope (não confundir com a
 * service_role key de um projeto de cliente, que vive encriptada em
 * `projects.encrypted_credentials`). `import "server-only"` faz o build
 * falhar se este módulo for alguma vez importado por um Client Component —
 * é a rede de segurança contra a chave ir parar ao bundle do browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
