import { describe, expect, it } from "vitest";
import { analyzePolicySql } from "./analyze-policy";

describe("analyzePolicySql", () => {
  it("flags USING (true) on a select policy", () => {
    const findings = analyzePolicySql(`
      create policy "anyone_can_read" on public.profiles
      for select to anon
      using (true);
    `);
    expect(findings.some((f) => f.severity === "critical" && f.title.includes("USING (true)"))).toBe(true);
  });

  it("flags a write policy with USING but no WITH CHECK", () => {
    const findings = analyzePolicySql(`
      create policy "orders_update_own" on public.orders
      for update to authenticated
      using (auth.uid() = user_id);
    `);
    expect(findings.some((f) => f.title.includes("No WITH CHECK"))).toBe(true);
  });

  it("does not flag a write policy with a real WITH CHECK", () => {
    const findings = analyzePolicySql(`
      create policy "orders_update_own" on public.orders
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    `);
    expect(findings.some((f) => f.title.includes("No WITH CHECK"))).toBe(false);
    expect(findings.some((f) => f.severity === "critical")).toBe(false);
  });

  it("flags WITH CHECK (true)", () => {
    const findings = analyzePolicySql(`
      create policy "orders_insert" on public.orders
      for insert to authenticated
      with check (true);
    `);
    expect(findings.some((f) => f.title.includes("WITH CHECK (true)"))).toBe(true);
  });

  it("flags identity derived from a request header", () => {
    const findings = analyzePolicySql(`
      create policy "messages_select_own" on public.messages
      for select
      using (user_id = (current_setting('request.headers', true)::json ->> 'x-user-id')::uuid);
    `);
    expect(findings.some((f) => f.severity === "high" && f.title.includes("HTTP header"))).toBe(true);
  });

  it("flags FOR ALL as informational", () => {
    const findings = analyzePolicySql(`
      create policy "notes_all" on public.notes
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    `);
    expect(findings.some((f) => f.severity === "info" && f.title.includes("FOR ALL"))).toBe(true);
  });

  it("handles multiple policies in one paste independently", () => {
    const findings = analyzePolicySql(`
      create policy "a" on public.t for select using (true);
      create policy "b" on public.t for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
    `);
    expect(findings.filter((f) => f.severity === "critical")).toHaveLength(1);
  });

  it("returns an empty result for empty input", () => {
    expect(analyzePolicySql("")).toHaveLength(0);
  });

  it("prompts for a policy when only enable row level security is pasted", () => {
    const findings = analyzePolicySql("alter table public.orders enable row level security;");
    expect(findings[0]?.title).toContain("no CREATE POLICY");
  });

  it("says no obvious holes for a well-formed policy", () => {
    const findings = analyzePolicySql(`
      create policy "orders_select_own" on public.orders
      for select to authenticated
      using (auth.uid() = user_id);
    `);
    expect(findings.some((f) => f.title.includes("No obvious holes"))).toBe(true);
  });
});
