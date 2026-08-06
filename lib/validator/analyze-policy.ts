export interface ValidatorFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  detail: string;
}

interface ParsedPolicy {
  raw: string;
  command: "select" | "insert" | "update" | "delete" | "all" | "unknown";
  roles: string[];
  using: string | null;
  withCheck: string | null;
}

/** Extrai o conteúdo entre parênteses balanceados a partir do índice logo a seguir a "(". */
function extractBalanced(text: string, openParenIndex: number): string | null {
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return text.slice(openParenIndex + 1, i);
    }
  }
  return null;
}

function extractClause(block: string, keyword: string): string | null {
  const re = new RegExp(`\\b${keyword}\\s*\\(`, "i");
  const match = re.exec(block);
  if (!match) return null;
  const openParenIndex = match.index + match[0].length - 1;
  return extractBalanced(block, openParenIndex);
}

function parsePolicyBlock(block: string): ParsedPolicy {
  let command: ParsedPolicy["command"] = "unknown";
  const forMatch = /\bfor\s+(select|insert|update|delete|all)\b/i.exec(block);
  if (forMatch) command = forMatch[1]!.toLowerCase() as ParsedPolicy["command"];

  const roles: string[] = [];
  const toMatch = /\bto\s+([a-z0-9_,\s]+?)(?:\busing\b|\bwith\s+check\b|$)/i.exec(block);
  if (toMatch) {
    for (const r of toMatch[1]!.split(",")) {
      const trimmed = r.trim().toLowerCase();
      if (trimmed) roles.push(trimmed);
    }
  }

  const using = extractClause(block, "using");
  const withCheck = extractClause(block, "with\\s+check");

  return { raw: block, command, roles, using: using?.trim() ?? null, withCheck: withCheck?.trim() ?? null };
}

const HEADER_TRUST_PATTERN = /current_setting\s*\(\s*['"]request\.headers['"]/i;

function analyzeSinglePolicy(policy: ParsedPolicy): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  const usingIsTrue = policy.using !== null && /^\s*true\s*$/i.test(policy.using);
  const checkIsTrue = policy.withCheck !== null && /^\s*true\s*$/i.test(policy.withCheck);
  const isWriteCommand = policy.command === "insert" || policy.command === "update" || policy.command === "all";
  const isReadCommand = policy.command === "select" || policy.command === "all";
  const allowsAnon = policy.roles.length === 0 || policy.roles.includes("anon") || policy.roles.includes("public");

  if (isReadCommand && usingIsTrue) {
    findings.push({
      severity: "critical",
      title: "USING (true) — this policy hides no rows",
      detail: allowsAnon
        ? "Any caller, including unauthenticated (anon) requests, can read every row this policy applies to. This is functionally identical to having no RLS on the read path."
        : "Every authenticated user can read every row this policy applies to, regardless of who owns it.",
    });
  }

  if (isWriteCommand) {
    if (policy.withCheck === null && policy.using !== null) {
      findings.push({
        severity: "critical",
        title: "No WITH CHECK — USING is reused for writes",
        detail:
          "Without a separate WITH CHECK, Postgres falls back to the USING expression to validate writes. If USING only checks what a row currently looks like (e.g. \"auth.uid() = user_id\"), a caller can often still write a value that changes ownership, since the check is evaluated the same way as a read.",
      });
    } else if (checkIsTrue) {
      findings.push({
        severity: "critical",
        title: "WITH CHECK (true) — any row can be written",
        detail: "The write path has no restriction at all: a caller can insert or update a row into any state, including attaching it to a different user.",
      });
    }
  }

  if (policy.using && HEADER_TRUST_PATTERN.test(policy.using)) {
    findings.push({
      severity: "high",
      title: "Identity derived from an HTTP header, not auth.uid()",
      detail:
        "request.headers is fully controlled by the caller — anyone can set an arbitrary header on their own request. Use auth.uid(), which comes from the verified, signed JWT, instead.",
    });
  }
  if (policy.withCheck && HEADER_TRUST_PATTERN.test(policy.withCheck)) {
    findings.push({
      severity: "high",
      title: "WITH CHECK trusts an HTTP header, not auth.uid()",
      detail: "Same issue as above, on the write-validation side: a forgeable header should never stand in for auth.uid().",
    });
  }

  if (policy.command === "all") {
    findings.push({
      severity: "info",
      title: "FOR ALL covers every operation with one expression",
      detail:
        "Not a vulnerability by itself, but it makes it easy for a USING/WITH CHECK mismatch to go unnoticed, since the same rule silently applies to SELECT, INSERT, UPDATE and DELETE. Consider splitting into per-operation policies for anything beyond a simple owner check.",
    });
  }

  if (policy.roles.length === 0) {
    findings.push({
      severity: "info",
      title: "No \"to <role>\" clause — defaults to PUBLIC",
      detail: "Without an explicit \"to authenticated\" (or another role), this policy applies to every role Postgres knows about, anon included. Usually fine if USING already restricts by auth.uid(), but worth being explicit.",
    });
  }

  return findings;
}

/**
 * Analisador estático (heurístico, sem parser SQL real) para o validador
 * público /tools/rls-validator — PROJECT_SPEC § 10 "colas uma política,
 * dizemos se tem buracos. Sem login, sem ligação a nada." Corre inteiramente
 * no browser: nunca envia o SQL colado para um servidor.
 */
export function analyzePolicySql(sql: string): ValidatorFinding[] {
  const trimmed = sql.trim();
  if (!trimmed) return [];

  const policyBlocks: string[] = [];
  const policyStart = /create\s+policy/gi;
  let match: RegExpExecArray | null;
  const indices: number[] = [];
  while ((match = policyStart.exec(trimmed)) !== null) indices.push(match.index);

  if (indices.length === 0) {
    if (/enable\s+row\s+level\s+security/i.test(trimmed)) {
      return [
        {
          severity: "low",
          title: "RLS enabled, but no CREATE POLICY found here",
          detail:
            "With RLS on and zero policies, the table becomes inaccessible to everyone (including its intended users) — a functional bug rather than a leak. Paste the CREATE POLICY statement(s) too for a full check.",
        },
      ];
    }
    return [
      {
        severity: "info",
        title: "No CREATE POLICY statement found",
        detail: "Paste a full \"create policy ... on <table> for <select|insert|update|delete|all> using (...) with check (...)\" statement.",
      },
    ];
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!;
    const end = i + 1 < indices.length ? indices[i + 1]! : trimmed.length;
    policyBlocks.push(trimmed.slice(start, end));
  }

  const findings: ValidatorFinding[] = [];
  for (const block of policyBlocks) {
    findings.push(...analyzeSinglePolicy(parsePolicyBlock(block)));
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      title: "No obvious holes found",
      detail:
        "This heuristic check didn't flag anything, but it isn't a full SQL parser and can miss edge cases — it's not a substitute for a real scan against your live schema.",
    });
  }

  return findings;
}
