import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { generatePkce, buildAuthorizeUrl } from "@/lib/oauth/supabase";
import { encodeCookiePayload, PENDING_COOKIE } from "@/lib/oauth/cookie";

/** Arranca o fluxo "Ligar com Supabase" (PROJECT_SPEC § 6.1) a partir do wizard de ligação — nunca chamado sem sessão, para o callback saber para que utilizador está a ligar o projeto. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));

  const { state, codeVerifier, codeChallenge } = generatePkce();

  const cookieStore = await cookies();
  cookieStore.set(PENDING_COOKIE, encodeCookiePayload({ state, codeVerifier }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/oauth/supabase",
  });

  return NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge }));
}
