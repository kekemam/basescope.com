import { describe, expect, it } from "vitest";
import { anon001 } from "./anon-001";
import { createFakeAnonRest, createFakeSql, createTestContext } from "../test-utils";

describe("ANON-001", () => {
  it("critical quando a tabela tem linhas visíveis e colunas PII", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles", rls_enabled: false, anon_select: true }],
        [{ table_name: "profiles", pii_columns: ["email", "phone"] }],
      ]),
      anonRest: createFakeAnonRest({
        profiles: { status: 200, totalCount: 1204 },
      }),
    });

    const findings = await anon001.check(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.resourceName).toBe("public.profiles");
    expect(findings[0]?.evidence.anon_visible_rows).toBe(1204);
    expect(findings[0]?.evidence.pii_columns).toEqual(["email", "phone"]);
  });

  it("high quando há linhas visíveis mas sem PII", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "products", rls_enabled: false, anon_select: true }],
        [],
      ]),
      anonRest: createFakeAnonRest({
        products: { status: 200, totalCount: 40 },
      }),
    });

    const findings = await anon001.check(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("sem finding quando count = 0 (RLS filtrou tudo)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "orders", rls_enabled: true, anon_select: true }],
        [],
      ]),
      anonRest: createFakeAnonRest({
        orders: { status: 200, totalCount: 0 },
      }),
    });

    expect(await anon001.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando a resposta é 401/403/404", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "secrets", rls_enabled: true, anon_select: true }],
        [],
      ]),
      anonRest: createFakeAnonRest({
        secrets: { status: 401, totalCount: null },
      }),
    });

    expect(await anon001.check(ctx)).toHaveLength(0);
  });

  it("não sonda tabelas sem anon_select", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "internal", rls_enabled: true, anon_select: false }],
        [],
      ]),
      anonRest: createFakeAnonRest({
        internal: { status: 200, totalCount: 999 },
      }),
    });

    expect(await anon001.check(ctx)).toHaveLength(0);
  });
});
