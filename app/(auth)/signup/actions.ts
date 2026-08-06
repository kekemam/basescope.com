"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { getClientIp } from "@/lib/rate-limit/ip";

export interface SignupState {
  status: "idle" | "sent" | "error";
  message?: string;
}

export async function requestSignup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!email || !orgName) {
    return { status: "error", message: "Preenche o nome da organização e o email." };
  }

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`otp:${ip}`, 5, 600);
  if (!allowed) return { status: "error", message: "Demasiados pedidos. Tenta novamente daqui a alguns minutos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Lido pelo callback (app/auth/callback/route.ts) para criar a
      // organização + membership de owner com o admin client — nunca via
      // INSERT policy direta a `authenticated` (ver supabase/migrations/0001_init.sql).
      data: { pending_org_name: orgName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent", message: `Enviámos um link de confirmação para ${email}.` };
}
