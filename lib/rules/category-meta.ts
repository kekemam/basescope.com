const LABELS: Record<string, string> = {
  RLS: "Políticas RLS",
  PII: "Dados pessoais expostos",
  FN: "Funções perigosas",
  GRANT: "Privilégios excessivos",
  VIEW: "Views inseguras",
  STO: "Storage público",
  AUTH: "Configuração de autenticação",
  EF: "Edge Functions",
  GEN: "Configuração geral",
  CLIENT: "Segredos no cliente",
  ANON: "Leitura anónima de dados",
};

export function categoryForRuleId(ruleId: string): string {
  return ruleId.split("-")[0] ?? "GEN";
}

export function categoryLabel(key: string): string {
  return LABELS[key] ?? key;
}
