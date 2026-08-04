import { describe, expect, it } from "vitest";
import { rls007 } from "./rls-007";
import { createFakeSql, createTestContext } from "../test-utils";

describe("RLS-007", () => {
  it("medium para toda política FOR ALL", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            schemaname: "public",
            tablename: "orders",
            policyname: "orders_all",
            permissive: "PERMISSIVE",
            roles: ["authenticated"],
            cmd: "ALL",
            qual: "(auth.uid() = user_id)",
            with_check: "(auth.uid() = user_id)",
          },
        ],
      ]),
    });

    const findings = await rls007.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem findings quando não há políticas FOR ALL", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await rls007.check(ctx)).toHaveLength(0);
  });
});
