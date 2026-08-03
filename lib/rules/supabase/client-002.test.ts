import { afterEach, describe, expect, it, vi } from "vitest";
import { client002 } from "./client-002";
import { createTestContext, createFakeSql } from "../test-utils";

function mockSite(bundleContent: string, endpointStatuses: Record<string, number> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://app.example.com/") {
        return { ok: true, text: async () => `<script src="/bundle.js"></script>` } as Response;
      }
      if (url.includes("bundle.js")) {
        return { ok: true, text: async () => bundleContent } as Response;
      }
      if (init?.method === "HEAD") {
        const path = new URL(url).pathname + new URL(url).search;
        const status = endpointStatuses[path] ?? 404;
        return { ok: status === 200, status } as Response;
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLIENT-002", () => {
  it("sem findings quando verifiedDomain é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: null });
    expect(await client002.check(ctx)).toHaveLength(0);
  });

  it("critical: Stripe secret key no bundle", async () => {
    mockSite(`const stripe = require('stripe')('sk_live_${"a".repeat(24)}');`);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client002.check(ctx);
    expect(findings.some((f) => f.title.includes("Stripe secret key"))).toBe(true);
  });

  it("ignora sk_test_ (falso positivo explícito)", async () => {
    mockSite(`const stripe = require('stripe')('sk_test_${"a".repeat(24)}');`);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    expect(await client002.check(ctx)).toHaveLength(0);
  });

  it("padrão OpenAI só dispara com contexto (apiKey/Authorization/Bearer) próximo", async () => {
    const key = `sk-${"b".repeat(40)}`;
    mockSite(`const random = "${key}";`);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    expect(await client002.check(ctx)).toHaveLength(0);
  });

  it("padrão OpenAI dispara quando há apiKey por perto", async () => {
    const key = `sk-${"b".repeat(40)}`;
    mockSite(`const config = { apiKey: "${key}" };`);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client002.check(ctx);
    expect(findings.some((f) => f.title.includes("OpenAI"))).toBe(true);
  });

  it("critical quando /.env responde 200", async () => {
    mockSite("", { "/.env": 200 });
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client002.check(ctx);
    const envFinding = findings.find((f) => f.resourceName === "/.env");
    expect(envFinding?.severity).toBe("critical");
  });

  it("high quando /api/debug responde 200", async () => {
    mockSite("", { "/api/debug": 200 });
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client002.check(ctx);
    const debugFinding = findings.find((f) => f.resourceName === "/api/debug");
    expect(debugFinding?.severity).toBe("high");
  });
});
