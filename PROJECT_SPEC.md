# PROMPT DE CONSTRUÇÃO — "Basescope"
### Scanner de segurança para aplicações construídas com IA (Supabase / Firebase)
**Uso:** cola este ficheiro inteiro no Claude Code como `PROJECT_SPEC.md` na raiz do repositório, e depois diz: *"Lê o PROJECT_SPEC.md e implementa a Fase 1. Não avances para a Fase 2 sem eu confirmar."*

---

## 0. REGRA INEGOCIÁVEL — LÊ ISTO ANTES DE TUDO

Este produto **só analisa projetos cujo dono deu consentimento explícito e provou propriedade.**

É proibido implementar:
- Qualquer crawler que descubra projetos Supabase/Firebase de terceiros
- Qualquer varrimento de URLs que o utilizador não tenha verificado como suas
- Qualquer exfiltração de dados reais durante os testes (só contamos linhas, nunca lemos conteúdo)
- Qualquer armazenamento de dados de clientes finais do utilizador

Motivo prático, não moral: estás sediado em Portugal. Varrer sistemas alheios sem autorização cai na Lei do Cibercrime (Lei n.º 109/2009), artigo 6.º — acesso ilegítimo — e o artigo 7.º agrava se houver interferência. É crime público e não depende de queixa da vítima. Um produto construído sobre isso não é vendável a empresas e não é segurável. A verificação de propriedade **é** o produto — é o que distingue o Basescope de um script de hacker.

Todo o scan tem de estar precedido de:
1. Ligação OAuth à conta Supabase do próprio utilizador (o utilizador autoriza), **ou**
2. Introdução manual de credenciais do projeto dele + verificação de propriedade por DNS TXT ou ficheiro `/.well-known/rlsguard-verification.txt`

Antes do primeiro scan, o utilizador aceita um **Scan Authorization Agreement** (checkbox + timestamp + IP guardados em base de dados). Sem esse registo, o motor recusa executar.

---

## 1. O QUE ESTAMOS A CONSTRUIR

Um SaaS que liga ao projeto Supabase (e mais tarde Firebase) de um utilizador, deteta falhas de configuração de segurança, e devolve **o SQL exato para corrigir cada uma**. Depois monitoriza continuamente e alerta quando aparece uma regressão.

**Utilizador-alvo:** fundador não-técnico ou solo dev que construiu a app em Lovable / Bolt / Replit / v0 / Base44 / Claude Code, tem utilizadores reais, e não sabe se a base de dados está aberta ao mundo.

**Proposta de valor numa frase:** *"Descobre em 90 segundos se a tua app está a expor dados de utilizadores — e recebe o SQL para corrigir."*

**O que NÃO é:** não é um SAST genérico, não é um pentest, não é um scanner de dependências. É especificamente configuração de backend-as-a-service. Recusa scope creep.

---

## 2. STACK E RESTRIÇÕES

- **Frontend/backend:** Next.js 15 (App Router), TypeScript strict, React Server Components onde possível
- **Base de dados própria:** Supabase (projeto separado do dos clientes) com RLS ativo em todas as tabelas
- **Auth:** Supabase Auth (email OTP + GitHub OAuth)
- **UI:** Tailwind + shadcn/ui. Modo escuro por defeito.
- **Jobs/filas:** Supabase `pg_cron` + tabela `scan_jobs` com locking por `FOR UPDATE SKIP LOCKED`. Não introduzas Redis nem BullMQ.
- **Emails:** Resend
- **Pagamentos:** Stripe (Checkout + Customer Portal + Webhooks com verificação HMAC e idempotência)
- **Hosting:** Vercel
- **Erros:** Sentry (plano free)
- **Idiomas:** Inglês (principal) e Português-PT. i18n com `next-intl`. Estrutura preparada para alemão, sem traduzir já.

**Orçamento de infraestrutura: 150€/mês.** Consequências obrigatórias no design:
- Nada de contentores sempre a correr. Tudo em serverless functions com `maxDuration` de 60s.
- Um scan tem de caber em 60s. Se não couber, parte em sub-jobs encadeados.
- Rate limit rígido: máximo de scans/mês por plano, aplicado em base de dados, não em UI.
- Sem LLM no caminho crítico. LLM só para gerar a explicação em linguagem natural do relatório, com cache por `finding_type` — a explicação de "RLS desativado na tabela X" é sempre a mesma, gera-se uma vez e reutiliza-se.

---

## 3. MODELO DE DADOS

Cria estas tabelas no projeto Supabase do Basescope. **Todas com RLS ativo, políticas com `USING` e `WITH CHECK`.** (Se este produto tiver uma falha de RLS, acabou.)

```
organizations
  id, name, stripe_customer_id, plan (free|solo|pro|agency),
  scans_used_this_period, period_ends_at, created_at

memberships
  id, org_id, user_id, role (owner|admin|member)

projects
  id, org_id, name, provider (supabase|firebase),
  project_ref, region, connection_status,
  ownership_verified_at, verification_method (oauth|dns|file),
  encrypted_credentials (bytea, AES-256-GCM),
  created_at, last_scan_at, current_score

scan_authorizations
  id, project_id, user_id, agreed_at, ip_address, user_agent,
  agreement_version

scans
  id, project_id, status (queued|running|done|failed|partial),
  started_at, finished_at, score, findings_count,
  critical_count, high_count, medium_count, low_count,
  trigger (manual|scheduled|api|webhook), error_message

findings
  id, scan_id, project_id, rule_id, severity,
  resource_type (table|policy|function|bucket|auth|config|client),
  resource_name, title, description, evidence (jsonb),
  remediation_sql, remediation_steps, docs_url,
  status (open|fixed|ignored|false_positive),
  first_seen_at, resolved_at, ignored_reason

finding_history
  id, finding_id, scan_id, status, changed_at

api_keys
  id, org_id, name, key_hash, last_used_at, revoked_at

notification_settings
  id, project_id, email_enabled, slack_webhook_url,
  discord_webhook_url, notify_on (all|high_and_above|critical_only)

audit_log
  id, org_id, actor_user_id, action, target, metadata, created_at
```

**Encriptação de credenciais:** as chaves `service_role` dos clientes são a coisa mais perigosa que vais guardar. Regras:
- AES-256-GCM com chave em `ENCRYPTION_KEY` (variável de ambiente Vercel, nunca no repositório)
- Desencriptação só dentro do worker de scan, nunca numa função que responda ao browser
- Nunca em logs, nunca no Sentry (configura `beforeSend` para remover)
- Endpoint "revogar e apagar credenciais" acessível em 1 clique no dashboard
- Preferir sempre OAuth em vez de credenciais coladas à mão

---

## 4. MOTOR DE SCAN — CATÁLOGO DE REGRAS

Cada regra é um módulo isolado com esta interface:

```ts
interface Rule {
  id: string;                    // "SUPA-RLS-001"
  title: string;
  severity: 'critical'|'high'|'medium'|'low'|'info';
  category: string;
  check(ctx: ScanContext): Promise<Finding[]>;
  remediate(finding: Finding): { sql?: string; steps: string[] };
}
```

O `ScanContext` recebe um cliente Postgres com a `service_role` do cliente **e** um cliente anónimo com a `anon key`. As regras que testam acesso anónimo usam o segundo.

### 4.1 Row Level Security (o núcleo)

| ID | Regra | Sev |
|---|---|---|
| SUPA-RLS-001 | Tabela no schema `public` com RLS desativado | Critical |
| SUPA-RLS-002 | RLS ativo mas **zero políticas** definidas (tabela inacessível ou, com service_role no cliente, totalmente aberta) | High |
| SUPA-RLS-003 | Política com `USING (true)` em `SELECT` para o role `anon` | Critical |
| SUPA-RLS-004 | Política `INSERT`/`UPDATE` sem cláusula `WITH CHECK` — permite escrever linhas que a própria política não deixaria ler | Critical |
| SUPA-RLS-005 | `WITH CHECK` diferente de `USING` de forma que permite escalada (ex.: `USING (user_id = auth.uid())` mas `WITH CHECK (true)`) | Critical |
| SUPA-RLS-006 | Política que referencia coluna controlada pelo cliente em vez de `auth.uid()` (ex.: `USING (user_id = current_setting('request.jwt.claims')::json->>'user_id')` manipulável) | High |
| SUPA-RLS-007 | Política `FOR ALL` onde deveria haver políticas separadas por operação | Medium |
| SUPA-RLS-008 | Tabela com coluna de dados pessoais (email, phone, address, iban, nif, dob, ssn — deteção por nome + regex de amostra em 1 linha) sem RLS | Critical |
| SUPA-RLS-009 | Vista (`VIEW`) que expõe tabela protegida — as vistas herdam permissões do criador, não do consultante, salvo `security_invoker` | High |
| SUPA-RLS-010 | Materialized view acessível a `anon` | High |

### 4.2 Funções e privilégios

| ID | Regra | Sev |
|---|---|---|
| SUPA-FN-001 | Função `SECURITY DEFINER` sem `SET search_path = ''` — vetor clássico de escalada | Critical |
| SUPA-FN-002 | Função `SECURITY DEFINER` com `EXECUTE` concedido a `anon` | High |
| SUPA-FN-003 | Função que faz `INSERT`/`UPDATE`/`DELETE` sem validar `auth.uid()` | High |
| SUPA-FN-004 | `GRANT ALL ON SCHEMA public TO anon` ou `authenticated` | Critical |
| SUPA-FN-005 | Trigger que escreve em tabela sensível a partir de input do cliente | Medium |
| SUPA-FN-006 | Extensão instalada no schema `public` em vez de `extensions` | Low |

### 4.3 Storage

| ID | Regra | Sev |
|---|---|---|
| SUPA-STO-001 | Bucket público que contém ficheiros com nomes sugestivos de documentos pessoais (`id`, `passport`, `cc`, `invoice`, `contract`, `selfie`) | Critical |
| SUPA-STO-002 | Bucket sem políticas de storage definidas | High |
| SUPA-STO-003 | Política de storage com `bucket_id = X` sem restrição de `owner` ou path por `auth.uid()` | High |
| SUPA-STO-004 | Bucket sem limite de tamanho de ficheiro (`file_size_limit` nulo) | Medium |
| SUPA-STO-005 | Bucket sem `allowed_mime_types` — permite upload de HTML/SVG executável | Medium |

### 4.4 Autenticação

| ID | Regra | Sev |
|---|---|---|
| SUPA-AUTH-001 | Confirmação de email desativada | High |
| SUPA-AUTH-002 | Signups abertos numa app que devia ser por convite (heurística: existe tabela `invitations`/`invites` mas signup público está ativo) | Medium |
| SUPA-AUTH-003 | Redirect URLs com wildcard (`*`) | High |
| SUPA-AUTH-004 | JWT expiry acima de 24h | Medium |
| SUPA-AUTH-005 | Proteção contra password comprometida desativada | Medium |
| SUPA-AUTH-006 | Nenhum provider MFA ativo | Low |
| SUPA-AUTH-007 | `service_role` key com sinais de rotação nunca feita (mais de 365 dias) | Low |

### 4.5 Exposição no cliente (só em domínio verificado)

Faz `fetch` da página inicial e dos bundles JS referenciados **do domínio que o utilizador verificou**, e procura:

| ID | Regra | Sev |
|---|---|---|
| CLIENT-001 | `service_role` key presente no bundle JavaScript | Critical |
| CLIENT-002 | Chaves de terceiros expostas: `sk_live_` (Stripe), `re_` (Resend), `sk-ant-` / `sk-proj-` (LLM), AWS `AKIA`, Twilio `SK` | Critical |
| CLIENT-003 | Source maps `.map` publicados em produção | Medium |
| CLIENT-004 | `.env`, `.git/config`, `/api/debug` acessíveis publicamente | High |
| CLIENT-005 | Cabeçalhos de segurança em falta (CSP, HSTS, X-Frame-Options) | Low |
| CLIENT-006 | Endpoint PostgREST diretamente acessível sem gateway e a devolver `200` para `anon` em tabelas listadas | High |

### 4.6 Edge Functions

| ID | Regra | Sev |
|---|---|---|
| SUPA-EF-001 | Edge Function com `verify_jwt = false` que escreve na base de dados | High |
| SUPA-EF-002 | Webhook sem verificação de assinatura HMAC | High |
| SUPA-EF-003 | Edge Function que usa `service_role` sem verificar identidade do chamador | Critical |
| SUPA-EF-004 | CORS `*` numa função que aceita credenciais | Medium |

### 4.7 Higiene geral

| ID | Regra | Sev |
|---|---|---|
| GEN-001 | Backups PITR desativados num projeto com plano pago | Medium |
| GEN-002 | Base de dados sem índices em colunas usadas em políticas RLS (custo + timeout) | Low |
| GEN-003 | Tabelas órfãs sem uso há 90+ dias com dados pessoais | Low |

**Total alvo na Fase 1: ~40 regras.** Implementa primeiro as 12 marcadas Critical — cobrem 90% dos incidentes reais.

### Regra de ouro do motor
Ao verificar acesso anónimo, o teste é `SELECT count(*) FROM tabela LIMIT 1` com a `anon key`. **Nunca leias o conteúdo das linhas.** A evidência guardada é: nome da tabela, número de linhas visíveis, nomes das colunas. Nunca valores. Documenta isto na landing page — é argumento de venda.

---

## 5. REMEDIAÇÃO

Para cada finding, gera três coisas:

1. **SQL pronto a colar** no SQL Editor do Supabase. Exemplo para SUPA-RLS-004:
```sql
-- Política INSERT sem WITH CHECK em public.orders
DROP POLICY IF EXISTS "users can insert orders" ON public.orders;
CREATE POLICY "users can insert orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```
2. **Explicação em linguagem simples** — o que um atacante conseguia fazer, em 2 frases, sem jargão.
3. **Passo de verificação** — o comando ou clique que confirma que ficou resolvido.

Botão **"Copiar todo o SQL de correção"** que junta todos os findings críticos num único script comentado e ordenado por dependências. Este botão é a razão pela qual as pessoas pagam.

Botão **"Verificar correções"** que re-executa apenas as regras que falharam, em vez de um scan completo (poupa quota e dá gratificação imediata).

---

## 6. FLUXOS DE UTILIZADOR

### 6.1 Onboarding (alvo: 3 minutos até ao primeiro relatório)
1. Landing → "Scan grátis" → signup por email OTP
2. Escolher provider (Supabase / Firebase brevemente)
3. **Ligação:** botão "Ligar com Supabase" (OAuth) — caminho preferido. Alternativa: colar `project_ref` + `service_role` key, com aviso claro de onde a obter e o que fazemos com ela.
4. **Verificação de propriedade:** OAuth já prova. Se credenciais manuais, pedir confirmação adicional por email do projeto.
5. Aceitar o Scan Authorization Agreement (checkbox obrigatório)
6. Scan corre com progresso em tempo real (Supabase Realtime na tabela `scans`)
7. Relatório

### 6.2 Free vs. pago
- **Free:** 1 projeto, 1 scan/mês. Mostra a **contagem** de findings por severidade e revela na íntegra apenas os 3 primeiros críticos. O resto está desfocado com "Desbloquear 14 findings".
- Isto é o paywall. Não mostres tudo de graça, e não escondas o número total — o número é que cria a urgência.

### 6.3 Monitorização contínua (planos pagos)
- Scan agendado (diário no Pro, semanal no Solo) via `pg_cron`
- Alerta por email/Slack/Discord **apenas quando há finding novo** ou quando um resolvido regrediu. Nada de emails "está tudo bem" — treina as pessoas a ignorar.
- Digest semanal opcional com evolução do score

### 6.4 Score
0–100. Fórmula determinística e publicada:
```
score = 100 - (critical*20 + high*8 + medium*3 + low*1)  // mínimo 0
```
Mostra sempre a variação face ao scan anterior. Gráfico de linha dos últimos 30 dias.

---

## 7. PÁGINAS

```
/                        landing
/pricing
/security                como protegemos as credenciais (página de vendas real)
/docs                    catálogo público das ~40 regras, uma página por regra
/docs/rules/[ruleId]     explicação + exemplo vulnerável + correção  ← isto é o motor de SEO/GEO
/login  /signup
/app                     dashboard: projetos, score, últimos findings
/app/projects/new        wizard de ligação
/app/projects/[id]       overview do projeto
/app/projects/[id]/scans/[scanId]   relatório completo
/app/projects/[id]/settings          notificações, credenciais, apagar
/app/settings/billing
/app/settings/api-keys
/app/settings/team
/legal/privacy  /legal/terms  /legal/dpa  /legal/scan-authorization
```

**Relatório:** cabeçalho com score + contadores, filtros por severidade/estado, lista agrupada por categoria, cada finding expansível com evidência + SQL + explicação. Export PDF (para o utilizador mostrar ao cliente ou investidor) e export JSON.

---

## 8. PREÇOS E BILLING

| Plano | Preço | Projetos | Scans | Extras |
|---|---|---|---|---|
| Free | 0€ | 1 | 1/mês | 3 findings visíveis |
| Solo | 29€/mês | 3 | semanal | Todos os findings, SQL, email |
| Pro | 79€/mês | 10 | diário | Slack/Discord, PDF, API, histórico |
| Agency | 249€/mês | 50 | diário | White-label no PDF, sub-contas, prioridade |

Extra: **Auditoria única 299€** — scan completo + revisão manual tua + chamada de 30 min. Vende isto no relatório free a quem tem 5+ críticos. É a tua receita dos primeiros dois meses e a tua fonte de aprendizagem.

Implementação Stripe:
- Checkout Sessions com `client_reference_id = org_id`
- Webhooks: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Verificação de assinatura HMAC obrigatória
- Tabela `stripe_events` com `event_id` UNIQUE para idempotência
- Customer Portal para gestão de plano e cancelamento
- Anual com 2 meses grátis
- IVA: usa Stripe Tax. Entidade portuguesa a vender serviços digitais B2B na UE → autoliquidação (reverse charge) com validação do NIF/VAT ID no VIES. Para B2C na UE aplica-se o regime OSS. Confirma com o teu contabilista antes da primeira fatura — a alternativa é regularizar 6 meses de IVA para trás.

---

## 9. SEGURANÇA DO PRÓPRIO PRODUTO

Vais ser auditado pelos teus clientes. Faz isto desde o dia 1:
- RLS em todas as tabelas, com `WITH CHECK` em tudo
- `SET search_path = ''` em todas as funções `SECURITY DEFINER`
- Rate limiting por IP e por org em todos os endpoints (Upstash Ratelimit no free tier ou tabela própria)
- CSP restritiva, HSTS, sem `unsafe-eval`
- Sem source maps em produção
- Rotação documentada da `ENCRYPTION_KEY`
- Retenção: findings apagados 90 dias após o cancelamento; credenciais apagadas imediatamente
- Página `/security` que descreve tudo isto em linguagem clara
- **Corre o Basescope contra o próprio Basescope** e publica o score na landing page

---

## 10. LANÇAMENTO

### Landing page
- Headline: *"A tua app feita com IA está a expor a base de dados?"*
- Sub: *"Liga o teu Supabase e descobre em 90 segundos. Recebe o SQL para corrigir."*
- Prova social acima da dobra: o número de projetos analisados e a % com pelo menos um crítico (atualizado automaticamente a partir de dados agregados e anonimizados)
- Screenshot real do relatório, não mockup
- Secção "O que NÃO fazemos": não lemos dados, não guardamos linhas, não varremos sites de terceiros
- FAQ com as 8 objeções: "isto é seguro?", "porque precisam da service_role?", "e se eu não perceber SQL?", "posso cancelar?"

### Conteúdo (motor de aquisição)
As páginas `/docs/rules/[ruleId]` são 40 páginas indexáveis que respondem a pesquisas reais do tipo *"supabase rls policy without with check"*. Cada uma com: o erro, código vulnerável, código corrigido, e uma resposta autónoma de 40–60 palavras no topo (é isso que os motores de IA citam).

### Distribuição — primeiras 4 semanas
1. Ferramenta grátis pública: **validador de política RLS** — colas uma política, dizemos se tem buracos. Sem login, sem ligação a nada. Isca puro.
2. Post técnico: *"Analisei N projetos Supabase construídos com IA — eis o que encontrei"* (com dados agregados e consentidos). Publica em Hacker News, r/Supabase, r/SaaS, Indie Hackers, dev.to.
3. Responde a threads existentes sobre vazamentos de dados em apps vibe-coded. Sem spam: resposta técnica útil, link no fim.
4. Contacta diretamente 50 pessoas que lançaram apps no Product Hunt / vitrines do Lovable e Bolt nos últimos 60 dias. Oferece scan grátis. Este canal converte melhor que tudo o resto.

### Analytics
Plausible ou PostHog free. Eventos: `signup`, `project_connected`, `scan_completed`, `paywall_viewed`, `checkout_started`, `subscription_created`. Métrica única que importa nas primeiras 6 semanas: **% de signups que ligam um projeto**. Se estiver abaixo de 40%, o problema é o passo das credenciais.

---

## 11. PLANO DE 14 DIAS

**Fase 1 — Dias 1–4: núcleo**
Schema + auth + ligação por credenciais manuais + verificação + as 12 regras Critical + relatório básico. Sem billing, sem agendamento.
*Critério de aceitação: ligas o Buildflow e o teu projeto do Mampassar, e o relatório apanha algo que tu já sabias que estava lá.*

**Fase 2 — Dias 5–7: produto**
Restantes ~28 regras + SQL de remediação + "Copiar todo o SQL" + "Verificar correções" + score + histórico.

**Fase 3 — Dias 8–10: negócio**
Stripe completo + limites por plano + paywall no relatório + Resend (welcome, scan pronto, novo finding crítico, falha de pagamento) + páginas legais.

**Fase 4 — Dias 11–12: automação**
`pg_cron` + fila de jobs + alertas Slack/Discord + export PDF + OAuth Supabase.

**Fase 5 — Dias 13–14: lançamento**
Landing + 40 páginas de docs + validador RLS grátis + Sentry + rate limiting + auto-scan do próprio produto + deploy.

**Fora de âmbito na v1 (não implementes):** Firebase, GitHub Actions integration, multi-região, SSO, relatórios SOC2, scanner de dependências, correção automática. Firebase entra na v2 — a arquitetura de regras já tem de o suportar por interface, mas não escrevas as regras.

---

## 12. CRITÉRIOS DE ACEITAÇÃO PARA LANÇAR

- [ ] Nenhum scan corre sem `scan_authorizations` registado
- [ ] `service_role` de cliente nunca aparece em logs, Sentry, ou resposta HTTP
- [ ] Um scan completo de um projeto com 30 tabelas corre em <60s
- [ ] Zero falsos positivos nas 12 regras Critical, testadas contra 3 projetos reais teus
- [ ] O SQL de remediação corre sem erro num projeto de teste e o re-scan passa a verde
- [ ] Webhook Stripe é idempotente (testa a reenviar o mesmo evento 3 vezes)
- [ ] O próprio Basescope tem score 100
- [ ] Página `/security` explica exatamente o que guardamos e o que não guardamos
- [ ] Utilizador consegue apagar credenciais e conta em 2 cliques
- [ ] Testes: unitários para cada regra (com fixtures de schema vulnerável e corrigido), e2e do fluxo signup→ligar→scan→pagar

---

## 13. INSTRUÇÕES PARA O AGENTE

- Escreve TypeScript strict. Zero `any`.
- Cada regra num ficheiro próprio em `/lib/rules/supabase/`, com teste ao lado.
- Nunca inventes nomes de colunas do catálogo Postgres — consulta `pg_policies`, `pg_class`, `pg_proc`, `information_schema` e confirma o schema real antes de escrever a query.
- Antes de cada fase, mostra-me o plano de ficheiros a criar/alterar e espera confirmação.
- No fim de cada fase, corre `npm run build` e `npm test` e reporta o resultado.
- Comentários e mensagens de commit em inglês. Interface em EN + PT-PT.
- Se uma decisão de arquitetura tiver mais de um caminho razoável, pergunta em vez de escolher sozinho.
