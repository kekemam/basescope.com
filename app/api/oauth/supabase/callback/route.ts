import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/oauth/supabase";
import { encodeCookiePayload, decodeCookiePayload, PENDING_COOKIE, SESSION_COOKIE } from "@/lib/oauth/cookie";

interface PendingState {
  state: string;
  codeVerifier: string;
}

/** Troca o code pelo par de tokens e guarda-o num cookie próprio, curto (10min) — a escolha de projeto acontece na página seguinte (oauth-select), que lê este cookie. */
export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const pendingRaw = cookieStore.get(PENDING_COOKIE)?.value;
  cookieStore.delete(PENDING_COOKIE);

  if (!code || !state || !pendingRaw) {
    return NextResponse.redirect(new URL("/app/projects/new?oauth_error=missing_params", siteUrl));
  }

  let pending: PendingState;
  try {
    pending = decodeCookiePayload<PendingState>(pendingRaw);
  } catch {
    return NextResponse.redirect(new URL("/app/projects/new?oauth_error=invalid_state", siteUrl));
  }

  if (pending.state !== state) {
    return NextResponse.redirect(new URL("/app/projects/new?oauth_error=state_mismatch", siteUrl));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, pending.codeVerifier);
    cookieStore.set(SESSION_COOKIE, encodeCookiePayload(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/app/projects/new",
    });
  } catch (err) {
    console.error("[oauth/supabase] falha ao trocar code por tokens", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/app/projects/new?oauth_error=token_exchange_failed", siteUrl));
  }

  return NextResponse.redirect(new URL("/app/projects/new/oauth-select", siteUrl));
}
