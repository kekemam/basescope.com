import { afterEach, describe, expect, it, vi } from "vitest";
import { ef002 } from "./ef-002";
import { createTestContext, createFakeSql } from "../test-utils";

function mockFetchSequence(functions: Array<{ slug: string; verify_jwt: boolean; status: string; version: number }>, bodies: Record<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/functions")) {
        return { ok: true, json: async () => functions } as Response;
      }
      const slug = url.split("/functions/")[1]?.split("/body")[0] ?? "";
      return { ok: true, text: async () => bodies[slug] ?? "" } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EF-002", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await ef002.check(ctx)).toHaveLength(0);
  });

  it("high: função stripe-webhook sem verificação HMAC", async () => {
    mockFetchSequence(
      [{ slug: "stripe-webhook", verify_jwt: false, status: "ACTIVE", version: 1 }],
      { "stripe-webhook": "const sig = req.headers.get('stripe-signature'); processEvent(await req.json());" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await ef002.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("sem finding quando o webhook verifica a assinatura", async () => {
    mockFetchSequence(
      [{ slug: "stripe-webhook", verify_jwt: false, status: "ACTIVE", version: 1 }],
      { "stripe-webhook": "stripe.webhooks.constructEvent(body, sig, secret);" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef002.check(ctx)).toHaveLength(0);
  });

  it("ignora funções que exigem JWT (não são webhooks públicos)", async () => {
    mockFetchSequence(
      [{ slug: "internal-hook", verify_jwt: true, status: "ACTIVE", version: 1 }],
      { "internal-hook": "doStuff();" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef002.check(ctx)).toHaveLength(0);
  });

  it("ignora funções que não parecem webhooks", async () => {
    mockFetchSequence(
      [{ slug: "public-page", verify_jwt: false, status: "ACTIVE", version: 1 }],
      { "public-page": "return new Response('hello');" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef002.check(ctx)).toHaveLength(0);
  });
});
