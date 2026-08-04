import { afterEach, describe, expect, it, vi } from "vitest";
import { gen001 } from "./gen-001";
import { createTestContext, createFakeSql } from "../test-utils";

function mockFetch(project: Record<string, unknown>, backups: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/database/backups")) return { ok: true, json: async () => backups } as Response;
      return { ok: true, json: async () => project } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GEN-001", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await gen001.check(ctx)).toHaveLength(0);
  });

  it("medium quando plano pago e PITR desativado", async () => {
    mockFetch({ plan: "pro" }, { pitr_enabled: false });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await gen001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem findings no plano free", async () => {
    mockFetch({ plan: "free" }, { pitr_enabled: false });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await gen001.check(ctx)).toHaveLength(0);
  });

  it("sem findings quando PITR está ativo", async () => {
    mockFetch({ plan: "pro" }, { pitr_enabled: true });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await gen001.check(ctx)).toHaveLength(0);
  });

  it("sem findings quando os campos esperados não existem (não verificável)", async () => {
    mockFetch({}, {});
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await gen001.check(ctx)).toHaveLength(0);
  });
});
