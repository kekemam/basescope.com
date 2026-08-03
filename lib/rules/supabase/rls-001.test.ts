import { describe, expect, it } from "vitest";
import { rls001 } from "./rls-001";
import { createFakeSql, createTestContext } from "../test-utils";

describe("RLS-001", () => {
  it("critical quando RLS está desativado e anon ou authenticated têm SELECT", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            table_name: "profiles",
            relrowsecurity: false,
            relforcerowsecurity: false,
            policy_count: 0,
            anon_select: true,
            auth_select: true,
            size: "128 kB",
          },
        ],
        [],
      ]),
    });

    const findings = await rls001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.resourceName).toBe("public.profiles");
  });

  it("sem finding quando RLS desativado mas sem grants a anon/authenticated", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            table_name: "internal_cache",
            relrowsecurity: false,
            relforcerowsecurity: false,
            policy_count: 0,
            anon_select: false,
            auth_select: false,
            size: "8 kB",
          },
        ],
        [],
      ]),
    });

    expect(await rls001.check(ctx)).toHaveLength(0);
  });

  it("low quando RLS ativo mas zero políticas (tabela inacessível)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[], [{ table_name: "drafts", policy_count: 0 }]]),
    });

    const findings = await rls001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
    expect(findings[0]?.title).toContain("inacessível");
  });
});
