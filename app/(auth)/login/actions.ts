"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { getClientIp } from "@/lib/rate-limit/ip";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
}

export async function requestLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { status: "error", message: "Introduz o teu email." };

  // Sem isto, qualquer pessoa pode usar este form para enviar spam de
  // magic links para o email de terceiros — 5 pedidos / 10min por IP.
  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`otp:${ip}`, 5, 600);
  if (!allowed) return { status: "error", message: "Demasiados pedidos. Tenta novamente daqui a alguns minutos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) return { status: "error", message: error.message };
  return { status: "sent", message: `Enviámos um link de acesso para ${email}.` };
}
