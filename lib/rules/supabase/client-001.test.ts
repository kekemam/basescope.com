import { afterEach, describe, expect, it, vi } from "vitest";
import { client001 } from "./client-001";
import { createTestContext, createFakeSql } from "../test-utils";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = Buffer.from("fake-signature-bytes-000000").toString("base64url");
  return `${header}.${body}.${signature}`;
}

function mockSite(bundleContent: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "https://app.example.com/") {
        return {
          ok: true,
          text: async () => `<html><script src="/static/bundle.js"></script></html>`,
        } as Response;
      }
      if (url.includes("bundle.js")) {
        return { ok: true, text: async () => bundleContent } as Response;
      }
      return { ok: false, text: async () => "" } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLIENT-001", () => {
  it("sem findings quando verifiedDomain é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: null });
    expect(await client001.check(ctx)).toHaveLength(0);
  });

  it("critical quando encontra JWT com role=service_role", async () => {
    const token = makeJwt({ role: "service_role", iss: "supabase" });
    mockSite(`const SUPABASE_KEY = "${token}";`);

    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client001.check(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.evidence.role).toBe("service_role");
    expect(String(findings[0]?.evidence.prefix)).not.toContain(token);
  });

  it("ignora JWT com role=anon (é suposto estar aqui)", async () => {
    const token = makeJwt({ role: "anon", iss: "supabase" });
    mockSite(`const SUPABASE_KEY = "${token}";`);

    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    expect(await client001.check(ctx)).toHaveLength(0);
  });

  it("critical quando encontra chave sb_secret_ (formato novo)", async () => {
    mockSite(`const KEY = "sb_secret_abcdefghijklmnopqrstuvwx";`);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });
});
