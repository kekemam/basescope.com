import { afterEach, describe, expect, it, vi } from "vitest";
import { auth007 } from "./auth-007";
import { createTestContext, createFakeSql } from "../test-utils";

function mockFetch(keys: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => keys })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AUTH-007", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await auth007.check(ctx)).toHaveLength(0);
  });

  it("low quando a service_role key tem mais de 365 dias", async () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch([{ name: "service_role", created_at: oldDate }]);
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await auth007.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
  });

  it("sem findings quando a chave é recente", async () => {
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch([{ name: "service_role", created_at: recentDate }]);
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await auth007.check(ctx)).toHaveLength(0);
  });

  it("sem findings quando não há campo de data (não verificável)", async () => {
    mockFetch([{ name: "service_role" }]);
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await auth007.check(ctx)).toHaveLength(0);
  });
});
