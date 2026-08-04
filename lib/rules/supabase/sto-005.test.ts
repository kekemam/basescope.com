import { describe, expect, it } from "vitest";
import { sto005 } from "./sto-005";
import { createFakeSql, createTestContext } from "../test-utils";

describe("STO-005", () => {
  it("medium para bucket sem allowed_mime_types", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ id: "uploads", allowed_mime_types: null }]]),
    });
    const findings = await sto005.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem findings quando não há buckets sem restrição", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await sto005.check(ctx)).toHaveLength(0);
  });
});
