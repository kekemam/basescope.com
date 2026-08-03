/** Normalização e helpers partilhados por RLS-002 e RLS-003 (docs/rules-critical.md). */

export function normalize(expr: string | null): string {
  return (expr ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export const OPEN = new Set(["true", "(true)", "1 = 1", "(1 = 1)"]);

export function rolesInclude(roles: string[], role: string): boolean {
  return roles.includes(role) || roles.includes("public");
}

export interface PgPolicyRow {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

/** Regex de deteção de colunas PII por nome — ver docs/rules-critical.md § PII-001. */
export const PII_COLUMN_PATTERN =
  "(email|e_mail|phone|telefone|telemovel|mobile|address|morada|street|postal|zip|" +
  "iban|bic|swift|nif|vat|tax_id|ssn|nis|cc_number|card|cvv|" +
  "birth|dob|nascimento|passport|id_number|licen[sc]e|" +
  "latitude|longitude|ip_address|salary|salario|diagnosis|medical)";

export interface PiiTableRow {
  table_name: string;
  pii_columns: string[];
}
