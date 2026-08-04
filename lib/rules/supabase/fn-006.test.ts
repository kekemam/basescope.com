import { describe, expect, it } from "vitest";
import { fn006 } from "./fn-006";
import { createFakeSql, createTestContext } from "../test-utils";

describe("FN-006", () => {
  it("low para cada extensão instalada em public", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ extension_name: "pg_trgm", schema_name: "public" }]]),
    });

    const findings = await fn006.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
    expect(findings[0]?.resourceName).toBe("pg_trgm");
  });

  it("sem findings quando não há extensões em public", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await fn006.check(ctx)).toHaveLength(0);
  });
});
