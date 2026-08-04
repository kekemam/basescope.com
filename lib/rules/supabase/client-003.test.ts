import { afterEach, describe, expect, it, vi } from "vitest";
import { client003 } from "./client-003";
import { createTestContext, createFakeSql } from "../test-utils";

function mockSite(bundleContent: string, mapStatus: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "https://app.example.com/") {
        return { ok: true, text: async () => `<script src="/bundle.js"></script>` } as Response;
      }
      if (url.endsWith("bundle.js")) {
        return { ok: true, text: async () => bundleContent } as Response;
      }
      if (init?.method === "HEAD" && url.endsWith(".map")) {
        return { status: mapStatus } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CLIENT-003", () => {
  it("sem findings quando verifiedDomain é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: null });
    expect(await client003.check(ctx)).toHaveLength(0);
  });

  it("medium quando o .map do bundle está acessível", async () => {
    mockSite("console.log('x'); //# sourceMappingURL=/bundle.js.map", 200);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    const findings = await client003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem findings quando o .map devolve 404", async () => {
    mockSite("console.log('x');", 404);
    const ctx = createTestContext({ admin: createFakeSql([]), verifiedDomain: "app.example.com" });
    expect(await client003.check(ctx)).toHaveLength(0);
  });
});
