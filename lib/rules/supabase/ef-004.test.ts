import { afterEach, describe, expect, it, vi } from "vitest";
import { ef004 } from "./ef-004";
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

describe("EF-004", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await ef004.check(ctx)).toHaveLength(0);
  });

  it("medium: CORS * e lê Authorization", async () => {
    mockFetchSequence(
      [{ slug: "api-proxy", verify_jwt: true, status: "ACTIVE", version: 1 }],
      {
        "api-proxy": "headers.set('Access-Control-Allow-Origin', '*'); const auth = req.headers.get('Authorization');",
      },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await ef004.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem finding quando CORS * mas sem leitura de credenciais", async () => {
    mockFetchSequence(
      [{ slug: "public-api", verify_jwt: false, status: "ACTIVE", version: 1 }],
      { "public-api": "headers.set('Access-Control-Allow-Origin', '*');" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef004.check(ctx)).toHaveLength(0);
  });
});
