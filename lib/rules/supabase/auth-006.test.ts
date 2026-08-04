import { afterEach, describe, expect, it, vi } from "vitest";
import { auth006 } from "./auth-006";
import { createTestContext, createFakeSql } from "../test-utils";

function mockFetch(config: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => config })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AUTH-006", () => {
  it("sem findings quando mgmtToken é null", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await auth006.check(ctx)).toHaveLength(0);
  });

  it("low quando nenhum campo de MFA está ativo", async () => {
    mockFetch({ mfa_totp_enroll_enabled: false, mfa_phone_enroll_enabled: false });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    const findings = await auth006.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
  });

  it("sem findings quando TOTP está ativo", async () => {
    mockFetch({ mfa_totp_enroll_enabled: true });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await auth006.check(ctx)).toHaveLength(0);
  });

  it("sem findings quando nenhum campo de MFA conhecido está presente (não verificável)", async () => {
    mockFetch({ mailer_autoconfirm: false });
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: "tok" });
    expect(await auth006.check(ctx)).toHaveLength(0);
  });
});
