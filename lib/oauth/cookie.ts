import "server-only";
import { encryptCredentials, decryptCredentials } from "@/lib/crypto/encrypt";

export const PENDING_COOKIE = "basescope_oauth_pending";
export const SESSION_COOKIE = "basescope_oauth_session";

export function encodeCookiePayload(data: unknown): string {
  return encryptCredentials(JSON.stringify(data)).toString("base64url");
}

export function decodeCookiePayload<T>(value: string): T {
  return JSON.parse(decryptCredentials(Buffer.from(value, "base64url"))) as T;
}
