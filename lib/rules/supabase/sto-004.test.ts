import { describe, expect, it } from "vitest";
import { sto004 } from "./sto-004";
import { createFakeSql, createTestContext } from "../test-utils";

describe("STO-004", () => {
  it("medium para bucket sem file_size_limit", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ id: "uploads", file_size_limit: null }]]),
    });
    const findings = await sto004.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem findings quando não há buckets sem limite", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await sto004.check(ctx)).toHaveLength(0);
  });
});
