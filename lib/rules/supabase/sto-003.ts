import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, type PgPolicyRow } from "./_shared";

interface BucketRow {
  id: string;
}

const RULE_ID = "STO-003";
const DOCS_URL = docsUrlFor(RULE_ID);
const NO_POLICIES_TITLE = "Bucket sem políticas de storage definidas";
const NO_OWNER_RESTRICTION_TITLE = "Política de storage sem restrição por dono/path";

const BUCKET_ID_PATTERN = /bucket_id\s*=\s*'([^']+)'/i;
const OWNER_RESTRICTION_PATTERN = /auth\.uid\s*\(\s*\)|foldername|storage\.filename|owner\s*=/i;

function bucketIdFromPolicy(policy: PgPolicyRow): string | null {
  const qual = policy.qual ?? "";
  const check = policy.with_check ?? "";
  const match = BUCKET_ID_PATTERN.exec(qual) ?? BUCKET_ID_PATTERN.exec(check);
  return match?.[1] ?? null;
}

function noPoliciesRemediation(bucket: string) {
  return {
    sql: `create policy "${bucket}_read_own"
  on storage.objects for select to authenticated
  using (bucket_id = '${bucket}' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "${bucket}_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = '${bucket}' and (storage.foldername(name))[1] = auth.uid()::text);`,
    steps: [
      "Sem nenhuma política de storage para este bucket, o comportamento depende só da flag `public` — cria políticas explícitas.",
    ],
  };
}

function ownerRestrictionRemediation(bucket: string, policyName: string) {
  return {
    sql: `drop policy if exists "${policyName}" on storage.objects;

create policy "${bucket}_read_own"
  on storage.objects for select to authenticated
  using (bucket_id = '${bucket}' and (storage.foldername(name))[1] = auth.uid()::text);`,
    steps: ["Restringe a política a `(storage.foldername(name))[1] = auth.uid()::text` (ou coluna `owner`), não só ao bucket_id."],
  };
}

/**
 * Cobre SUPA-STO-002 (zero políticas) e SUPA-STO-003 (política existe mas
 * não restringe por dono/path) — são as duas faces da mesma pergunta:
 * "esta política de storage protege alguma coisa além do bucket em si?".
 */
export const sto003: Rule = {
  id: RULE_ID,
  title: "Bucket sem políticas de storage adequadas",
  severity: "high",
  category: "storage",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const buckets = await ctx.admin<BucketRow[]>`select id from storage.buckets`;
    if (buckets.length === 0) return [];

    const policies = await ctx.admin<PgPolicyRow[]>`
      select policyname, cmd, roles, qual, with_check, schemaname, tablename
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
    `;

    const policiesByBucket = new Map<string, PgPolicyRow[]>();
    for (const policy of policies) {
      const bucketId = bucketIdFromPolicy(policy);
      if (!bucketId) continue;
      const list = policiesByBucket.get(bucketId) ?? [];
      list.push(policy);
      policiesByBucket.set(bucketId, list);
    }

    const findings: Finding[] = [];

    for (const bucket of buckets) {
      const bucketPolicies = policiesByBucket.get(bucket.id) ?? [];

      if (bucketPolicies.length === 0) {
        const remed = noPoliciesRemediation(bucket.id);
        findings.push({
          ruleId: RULE_ID,
          severity: "high",
          resourceType: "bucket",
          resourceName: bucket.id,
          title: NO_POLICIES_TITLE,
          description: `O bucket "${bucket.id}" não tem nenhuma política de storage — o acesso depende só da flag "public" do bucket.`,
          evidence: { bucket: bucket.id, policy_count: 0 },
          remediationSql: remed.sql,
          remediationSteps: remed.steps,
          docsUrl: DOCS_URL,
        });
        continue;
      }

      for (const policy of bucketPolicies) {
        if (!["SELECT", "ALL"].includes(policy.cmd)) continue;
        const qual = normalize(policy.qual);
        if (!qual) continue;
        if (OWNER_RESTRICTION_PATTERN.test(qual)) continue;

        const remed = ownerRestrictionRemediation(bucket.id, policy.policyname);
        findings.push({
          ruleId: RULE_ID,
          severity: "high",
          resourceType: "bucket",
          resourceName: `${bucket.id} policy ${policy.policyname}`,
          title: NO_OWNER_RESTRICTION_TITLE,
          description: `A política "${policy.policyname}" restringe por bucket_id mas não por dono/path — qualquer utilizador autenticado lê ficheiros de qualquer pessoa no bucket "${bucket.id}".`,
          evidence: { bucket: bucket.id, policy: policy.policyname, qual: policy.qual },
          remediationSql: remed.sql,
          remediationSteps: remed.steps,
          docsUrl: DOCS_URL,
        });
      }
    }

    return findings;
  },
};
