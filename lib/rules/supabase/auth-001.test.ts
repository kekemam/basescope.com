import { afterEach, describe, expect, it, vi } from "vitest";
import { auth001 } from "./auth-001";
import { createFakeSql, createTestContext } from "../test-utils";

function mockFetch(config: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        mailer_autoconfirm: false,
        disable_signup: true,
        uri_allow_list: "https://app.example.com/callback",
        jwt_exp: 3600,
        password_min_length: 8,
        security_update_password_require_reauthentication: true,
        password_hibp_enabled: true,
        ...config,
      }),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AUTH-001", () => {
  it("sem findings quando mgmtToken é null (não verificada)", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]), mgmtToken: null });
    expect(await auth001.check(ctx)).toHaveLength(0);
  });

  it("critical quando mailer_autoconfirm=true e há PII legível por authenticated", async () => {
    mockFetch({ mailer_autoconfirm: true });
    const ctx = createTestContext({
      admin: createFakeSql([[], [{ table_name: "profiles" }]]),
      mgmtToken: "mgmt-token",
    });

    const findings = await auth001.check(ctx);
    const emailFinding = findings.find((f) => f.resourceName === "auth.config.mailer_autoconfirm");
    expect(emailFinding?.severity).toBe("critical");
  });

  it("high (não critical) quando mailer_autoconfirm=true mas sem PII exposta", async () => {
    mockFetch({ mailer_autoconfirm: true });
    const ctx = createTestContext({
      admin: createFakeSql([[], []]),
      mgmtToken: "mgmt-token",
    });

    const findings = await auth001.check(ctx);
    const emailFinding = findings.find((f) => f.resourceName === "auth.config.mailer_autoconfirm");
    expect(emailFinding?.severity).toBe("high");
  });

  it("flag signup público aberto quando existe tabela de convites", async () => {
    mockFetch({ disable_signup: false });
    const ctx = createTestContext({
      admin: createFakeSql([[{ table_name: "invitations" }]]),
      mgmtToken: "mgmt-token",
    });

    const findings = await auth001.check(ctx);
    expect(findings.some((f) => f.resourceName === "auth.config.disable_signup")).toBe(true);
  });

  it("sem findings quando tudo está bem configurado", async () => {
    mockFetch({});
    const ctx = createTestContext({ admin: createFakeSql([[]]), mgmtToken: "mgmt-token" });
    expect(await auth001.check(ctx)).toHaveLength(0);
  });

  it("flag JWT expiry acima de 24h", async () => {
    mockFetch({ jwt_exp: 604800 });
    const ctx = createTestContext({ admin: createFakeSql([[]]), mgmtToken: "mgmt-token" });
    const findings = await auth001.check(ctx);
    expect(findings.some((f) => f.resourceName === "auth.config.jwt_exp")).toBe(true);
  });
});
