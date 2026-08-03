import { afterEach, describe, expect, it, vi } from "vitest";
import { ef001 } from "./ef-001";
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

describe("EF-001", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await ef001.check(ctx)).toHaveLength(0);
  });

  it("critical: usa service_role, verify_jwt=false, não valida o chamador", async () => {
    mockFetchSequence(
      [{ slug: "admin-task", verify_jwt: false, status: "ACTIVE", version: 1 }],
      { "admin-task": "const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); doStuff(key);" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await ef001.check(ctx);
    expect(findings.some((f) => f.severity === "critical")).toBe(true);
  });

  it("sem finding quando valida o chamador com auth.getUser()", async () => {
    mockFetchSequence(
      [{ slug: "safe-task", verify_jwt: false, status: "ACTIVE", version: 1 }],
      {
        "safe-task": `
          const { data: { user }, error } = await userClient.auth.getUser();
          if (error || !user) return new Response('Unauthorized', { status: 401 });
          const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
        `,
      },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef001.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando não usa service_role", async () => {
    mockFetchSequence(
      [{ slug: "public-task", verify_jwt: true, status: "ACTIVE", version: 1 }],
      { "public-task": "console.log('hello')" },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await ef001.check(ctx)).toHaveLength(0);
  });

  it("medium: CORS aberto e lê o header Authorization", async () => {
    mockFetchSequence(
      [{ slug: "cors-task", verify_jwt: true, status: "ACTIVE", version: 1 }],
      {
        "cors-task": `
          headers.set('Access-Control-Allow-Origin', '*');
          const auth = req.headers.get('Authorization');
        `,
      },
    );
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await ef001.check(ctx);
    expect(findings.some((f) => f.severity === "medium" && f.title.includes("CORS"))).toBe(true);
  });
});
