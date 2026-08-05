import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email/resend";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  const admin = createAdminClient();
  const { data: existingMembership } = await admin
    .from("memberships")
    .select("id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();

  if (!existingMembership) {
    // Primeiro login: cria a organização + membership de owner com o
    // admin client, fora do alcance das RLS policies de `authenticated`
    // (ver comentário em supabase/migrations/0001_init.sql).
    const pendingOrgName = (data.user.user_metadata?.pending_org_name as string | undefined) ?? "A minha organização";

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: pendingOrgName })
      .select("id")
      .single();

    if (orgError) {
      return NextResponse.redirect(`${origin}/login?error=org_creation_failed`);
    }

    await admin.from("memberships").insert({ org_id: org.id, user_id: data.user.id, role: "owner" });

    if (data.user.email) await sendWelcomeEmail(data.user.email);
  }

  return NextResponse.redirect(`${origin}/app`);
}
