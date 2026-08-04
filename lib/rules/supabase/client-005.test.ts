import { afterEach, describe, expect, it, vi } from "vitest";
import { client005 } from "./client-005";
import { createTestContext, createFakeSql } from "../test-utils";

function mockSite(headers: Record<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ headers: new Headers(headers) }) as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLIENT-005", () => {
  it("sem findings quando verifiedDomain é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: null });
    expect(await client005.check(ctx)).toHaveLength(0);
  });

  it("low quando faltam cabeçalhos de segurança", async () => {
    mockSite({});
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client005.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
    expect(findings[0]?.evidence.missing_headers).toEqual([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
    ]);
  });

  it("sem findings quando todos os cabeçalhos estão presentes", async () => {
    mockSite({
      "content-security-policy": "default-src 'self'",
      "strict-transport-security": "max-age=63072000",
      "x-frame-options": "DENY",
    });
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    expect(await client005.check(ctx)).toHaveLength(0);
  });
});
