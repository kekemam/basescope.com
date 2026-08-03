# Basescope — As 12 Regras Critical (Fase 1)
### Queries ao catálogo, lógica de deteção, SQL de remediação e armadilhas de falsos positivos

**Uso:** guarda como `docs/rules-critical.md` no repositório. Diz ao Claude Code: *"Implementa as regras deste ficheiro uma a uma em `/lib/rules/supabase/`, cada uma com o seu teste. Começa pela ANON-001."*

---

## ⚠️ CORREÇÃO IMPORTANTE AO SPEC ORIGINAL

O spec dizia "política INSERT/UPDATE sem `WITH CHECK`" = Critical. **Isso está errado e vai gerar falsos positivos em massa.**

Comportamento real do Postgres:
- Numa política `FOR UPDATE` ou `FOR ALL`, se `WITH CHECK` for omitido, o Postgres **usa a expressão `USING` como verificação de escrita**. Omitir é seguro.
- Numa política `FOR INSERT`, só `WITH CHECK` se aplica. Omitir dá `true` implícito — aí sim é perigoso.

O verdadeiro problema não é a ausência, é a **divergência**: `USING` restritivo com `WITH CHECK (true)` explícito. É esse o padrão que abre escalada de privilégios. As regras abaixo refletem isto.

---

## Interface comum

```ts
// /lib/rules/types.ts
export interface ScanContext {
  admin: postgres.Sql;          // service_role — só leitura de catálogo
  anonRest: AnonRestClient;     // PostgREST com anon key
  projectRef: string;
  verifiedDomain: string | null;
  mgmtToken: string | null;     // Management API, só se OAuth
}

export interface Finding {
  ruleId: string;
  severity: 'critical'|'high'|'medium'|'low';
  resourceType: 'table'|'policy'|'function'|'bucket'|'auth'|'config'|'client'|'edge_function';
  resourceName: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;   // NUNCA valores de linhas
  remediationSql: string | null;
  remediationSteps: string[];
  docsUrl: string;
}
```

**Regra absoluta do `evidence`:** nomes de tabelas, nomes de colunas, contagens, nomes de políticas, expressões de política. Nunca valores de células. Nunca emails, nunca IDs de utilizadores finais.

---

# ANON-001 — Tabela legível por utilizador anónimo
### Severidade: Critical · A regra mais importante do produto

Esta é a única regra que prova exposição empiricamente em vez de a inferir. Todas as outras são análise estática; esta é o teste real.

### Deteção

1. Lista as tabelas candidatas:
```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')          -- tabelas e particionadas
order by c.relname;
```

2. Para cada tabela com `anon_select = true`, faz um pedido **HEAD** ao PostgREST com a anon key:

```
HEAD https://{ref}.supabase.co/rest/v1/{table}?select=*
  apikey: {anon_key}
  Authorization: Bearer {anon_key}
  Prefer: count=exact
  Range: 0-0
```

Lê o cabeçalho `Content-Range` (formato `0-0/1234`). O número depois da barra é a contagem de linhas visíveis ao anónimo.

**Usa HEAD, não GET.** O HEAD não devolve corpo — nunca chegas a ver dados reais. Isto é uma decisão de design que tens de publicar na página `/security`, porque é a objeção número um dos clientes.

3. Finding se `count > 0`.

### Classificação de severidade
- `count > 0` e a tabela tem colunas PII (ver PII-001) → **Critical**
- `count > 0` sem PII → **High**
- `count = 0` mas resposta `200` (tabela existe, RLS filtrou tudo) → sem finding, é o comportamento correto
- Resposta `401`/`403`/`404` → sem finding

### Falsos positivos a evitar
- Tabelas legitimamente públicas: `countries`, `currencies`, `plans`, `pricing`, `blog_posts`, `products`, `categories`, `faqs`. Não as excluas automaticamente — mostra o finding mas com um botão **"Isto é público de propósito"** que o marca como `ignored` para sempre e não volta a alertar.
- Vistas (`relkind = 'v'`) são tratadas na regra VIEW-001, não aqui.

### Remediação
```sql
-- 1. Ativar RLS
alter table public.{table} enable row level security;

-- 2. Política mínima: cada utilizador vê apenas as suas linhas
create policy "{table}_select_own"
  on public.{table}
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 3. Confirmar que o anónimo não tem acesso residual
revoke all on public.{table} from anon;
```

**Passo de verificação:** re-executa o HEAD. `Content-Range` tem de passar a `*/0` ou o pedido a devolver `401`.

---

# RLS-001 — RLS desativado em tabela do schema `public`
### Severidade: Critical

### Deteção
```sql
select c.relname as table_name,
       c.relrowsecurity,
       c.relforcerowsecurity,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policy_count,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
       pg_size_pretty(pg_total_relation_size(c.oid)) as size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and c.relrowsecurity = false;
```

Finding quando `relrowsecurity = false` **e** (`anon_select` ou `auth_select`).

> Uma tabela sem RLS mas também sem `GRANT` a `anon`/`authenticated` não está exposta pela API. O Supabase concede por defeito, mas alguns projetos revogam. Verifica sempre, não assumas — é aqui que a maioria dos scanners gera ruído.

### Caso especial: RLS ativo, zero políticas
Se `relrowsecurity = true` e `policy_count = 0`, a tabela fica **inacessível** a `anon`/`authenticated` (fail-closed). Não é falha de segurança, é falha funcional. Reporta como **Low** com o título *"Tabela inacessível: RLS ativo sem políticas"* — os utilizadores adoram isto porque explica bugs que andam a perseguir há dias.

### Remediação
```sql
alter table public.{table} enable row level security;
alter table public.{table} force row level security;  -- aplica também ao dono da tabela
```
Seguido do template de política apropriado (ver ANON-001).

---

# RLS-002 — Política de leitura totalmente aberta ao anónimo
### Severidade: Critical

### Deteção
```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Em TypeScript, normaliza e avalia:

```ts
const normalize = (e: string | null) =>
  (e ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const OPEN = new Set(['true', '(true)']);

const rolesInclude = (roles: string[], r: string) =>
  roles.includes(r) || roles.includes('public');

// Critical
if (['SELECT', 'ALL'].includes(policy.cmd)
    && rolesInclude(policy.roles, 'anon')
    && OPEN.has(normalize(policy.qual))) { → finding }
```

Variantes que também contam como abertas e que um `=== 'true'` simples não apanha:
- `(1 = 1)`
- `(auth.role() = 'anon'::text)` numa política `FOR SELECT TO anon`
- `(auth.uid() is not null)` numa política `TO public` — parece restritivo mas o role `public` inclui `anon`

Trata `roles = {public}` como equivalente a incluir `anon`. Esta é a confusão mais comum: as pessoas escrevem `TO public` a pensar "utilizadores autenticados".

### Remediação
```sql
drop policy if exists "{policy_name}" on public.{table};

create policy "{table}_select_own"
  on public.{table}
  for select
  to authenticated
  using (auth.uid() = user_id);
```

Se a tabela for de facto pública, a versão correta é explícita:
```sql
create policy "{table}_public_read"
  on public.{table}
  for select
  to anon, authenticated
  using (published = true);   -- nunca 'true' cru
```

---

# RLS-003 — `WITH CHECK` mais permissivo que `USING` (escalada de privilégios)
### Severidade: Critical

O padrão que permite a um utilizador criar ou alterar linhas que pertencem a outro.

### Deteção

```ts
const qual  = normalize(policy.qual);
const check = normalize(policy.with_check);

// Caso A: FOR ALL / FOR UPDATE com USING restritivo e WITH CHECK aberto
if (['ALL', 'UPDATE'].includes(policy.cmd)
    && qual && !OPEN.has(qual)
    && check && OPEN.has(check)) { → CRITICAL }

// Caso B: FOR INSERT com WITH CHECK aberto ou ausente
if (['ALL', 'INSERT'].includes(policy.cmd)
    && rolesInclude(policy.roles, 'authenticated')
    && (!check || OPEN.has(check))) { → CRITICAL }

// Caso C: divergência estrutural — USING referencia auth.uid(), WITH CHECK não
if (qual.includes('auth.uid()') && check && !check.includes('auth.uid()')) { → CRITICAL }
```

### NÃO reportes
- `cmd = 'UPDATE'` ou `'ALL'` com `with_check = null` e `qual` restritivo → **seguro**, o Postgres usa o `USING` como verificação. Reportar isto era o erro do spec original.
- `cmd = 'SELECT'` ou `'DELETE'` com `with_check = null` → normal, essas operações não têm verificação de escrita.

### Exemplo do bug real
```sql
-- VULNERÁVEL: leio só as minhas encomendas, mas escrevo em qualquer uma
create policy "orders_all" on public.orders
  for all to authenticated
  using (auth.uid() = user_id)
  with check (true);
```
Um utilizador faz `UPDATE orders SET user_id = <outro>` e transfere a linha. Ou `INSERT` com `user_id` alheio.

### Remediação
```sql
drop policy if exists "{policy_name}" on public.{table};

create policy "{table}_select_own" on public.{table}
  for select to authenticated using (auth.uid() = user_id);

create policy "{table}_insert_own" on public.{table}
  for insert to authenticated with check (auth.uid() = user_id);

create policy "{table}_update_own" on public.{table}
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "{table}_delete_own" on public.{table}
  for delete to authenticated using (auth.uid() = user_id);
```

**Recomenda sempre políticas separadas por operação em vez de `FOR ALL`.** É mais verboso e é a razão pela qual esta classe de bug desaparece.

---

# PII-001 — Tabela com dados pessoais sem proteção
### Severidade: Critical

### Deteção
```sql
select c.relname as table_name,
       c.relrowsecurity,
       array_agg(a.attname order by a.attnum) as pii_columns
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and a.attname ~* '(email|e_mail|phone|telefone|telemovel|mobile|address|morada|street|postal|zip|
                     iban|bic|swift|nif|vat|tax_id|ssn|nis|cc_number|card|cvv|
                     birth|dob|nascimento|passport|id_number|licen[sc]e|
                     latitude|longitude|ip_address|salary|salario|diagnosis|medical)'
group by c.relname, c.relrowsecurity
having bool_or(c.relrowsecurity = false) or true;
```

Cruza o resultado com ANON-001 e RLS-001:
- Colunas PII **e** `relrowsecurity = false` → **Critical**
- Colunas PII **e** ANON-001 confirmou `count > 0` → **Critical**, é o pior cenário e devia aparecer no topo do relatório
- Colunas PII com RLS correto → sem finding, mas conta para uma secção informativa *"Tabelas com dados pessoais: 7"* (útil para RGPD)

### Nunca faças
Não faças amostragem de valores para confirmar que a coluna `email` contém emails. A heurística por nome basta e é falível na direção segura. Ler uma linha para "confirmar" destrói a tua promessa de privacidade e não vale o falso positivo evitado.

### Remediação
Igual a RLS-001 + ANON-001, mas com aviso adicional no relatório:

> Esta tabela contém dados pessoais na aceção do RGPD. Se esteve exposta publicamente, tens de avaliar a obrigação de notificação à autoridade de controlo no prazo de 72 horas (art. 33.º RGPD). Documenta a data em que a falha foi corrigida.

Não dês aconselhamento jurídico além disto. Aponta para a autoridade nacional e recomenda advogado.

---

# FN-001 — Função `SECURITY DEFINER` sem `search_path` fixo
### Severidade: Critical

Vetor clássico: a função corre com os privilégios do dono (normalmente `postgres`). Se o `search_path` for herdado do chamador, um utilizador cria um schema com uma função ou tabela de nome igual, força a resolução para o objeto dele, e executa código com privilégios de superutilizador.

### Deteção
```sql
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as is_security_definer,
       p.proconfig,
       pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'extensions',
                        'graphql', 'graphql_public', 'pgbouncer', 'realtime',
                        'storage', 'vault', 'supabase_functions', 'net', 'cron')
  and p.prosecdef = true
  and (
    p.proconfig is null
    or not exists (
      select 1 from unnest(p.proconfig) cfg
      where cfg like 'search_path=%'
    )
  );
```

Severidade:
- `anon_execute = true` → **Critical**
- só `auth_execute = true` → **Critical** (autenticado ≠ de confiança)
- nenhum dos dois → **Medium**

### Falsos positivos
Exclui funções cujo `owner` seja `supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`, `postgres` **quando estão em schemas do sistema**. As funções internas do Supabase aparecem aqui e não são responsabilidade do utilizador. Filtra por schema, como na query acima, e adicionalmente ignora `proname` que comece por `pgrst_` ou `_supabase`.

### Remediação
```sql
alter function public.{function}({args}) set search_path = '';
```

Com `search_path = ''` todas as referências dentro da função passam a precisar de qualificação completa. Avisa o utilizador: **isto pode partir a função** se ela usar `select * from users` em vez de `select * from public.users`. Dá o corpo atual da função no relatório para ele conseguir corrigir:

```sql
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = '{function}';
```

Alternativa menos intrusiva se ele não quiser tocar no corpo:
```sql
alter function public.{function}({args}) set search_path = public, pg_temp;
```
(Menos seguro, mas fecha o vetor principal. Marca como mitigação parcial, não como resolvido.)

---

# GRANT-001 — Privilégios excessivos no schema `public`
### Severidade: Critical

### Deteção
```sql
-- Privilégios ao nível do schema
select nspname,
       has_schema_privilege('anon', nspname, 'CREATE') as anon_create,
       has_schema_privilege('anon', nspname, 'USAGE') as anon_usage,
       has_schema_privilege('authenticated', nspname, 'CREATE') as auth_create,
       nspacl
from pg_namespace
where nspname = 'public';

-- Privilégios de escrita em tabelas sem RLS
select c.relname,
       c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
       has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
  and (has_table_privilege('anon', c.oid, 'INSERT')
    or has_table_privilege('anon', c.oid, 'UPDATE')
    or has_table_privilege('anon', c.oid, 'DELETE'));
```

Findings:
- `anon_create = true` no schema `public` → **Critical**. Um anónimo pode criar objetos na tua base de dados.
- `anon` com `INSERT`/`UPDATE`/`DELETE` numa tabela com `relrowsecurity = false` → **Critical**
- `anon` com `TRUNCATE` em qualquer tabela → **Critical**

### Remediação
```sql
revoke create on schema public from anon, authenticated;
revoke all on public.{table} from anon;

-- Se o anónimo precisa mesmo de escrever (ex.: formulário de contacto):
grant insert on public.contact_messages to anon;
alter table public.contact_messages enable row level security;
create policy "anyone_can_submit" on public.contact_messages
  for insert to anon with check (true);
-- e NENHUMA política de select para anon, para ele não conseguir ler o que outros submeteram
```

Este último exemplo é ouro para o relatório: mostra a forma **correta** de ter escrita anónima.

---

# STO-001 — Bucket público com ficheiros sensíveis
### Severidade: Critical

### Deteção
```sql
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
where public = true;
```

Para cada bucket público, sem ler ficheiros:
```sql
select bucket_id,
       count(*) as total_objects,
       count(*) filter (where name ~* '(passport|passaporte|id[-_ ]?card|cartao[-_ ]?cidadao|
                                        selfie|face|photo[-_ ]?id|driver|licen[sc]a|
                                        invoice|fatura|receipt|contract|contrato|
                                        payslip|recibo|iban|bank|extrato|
                                        medical|report|scan|document|nif|ssn|kyc)') as sensitive_named,
       count(*) filter (where name ~* '\.(pdf|docx?|xlsx?|csv)$') as document_files
from storage.objects
where bucket_id = $1
group by bucket_id;
```

Findings:
- `public = true` e `sensitive_named > 0` → **Critical**
- `public = true` e `document_files > 0` → **High**
- `public = true` só com imagens → **Medium** (pode ser legítimo: avatares, produtos)

### Verificação empírica (opcional, alto valor)
Constrói o URL público de **um** objeto com nome sensível e faz `HEAD`:
```
HEAD https://{ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
```
Se devolver `200`, tens prova de exposição. **HEAD, nunca GET** — nunca descarregas o ficheiro. Guarda no `evidence` apenas o status e o `content-length`, nunca o path completo (pode conter o ID do utilizador).

### Políticas de storage
```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```
Aplica-lhes RLS-002 e RLS-003. Um bucket privado com política `using (true)` está tão aberto como um público.

### Remediação
```sql
update storage.buckets set public = false where id = '{bucket}';

create policy "{bucket}_read_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = '{bucket}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "{bucket}_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = '{bucket}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = '{bucket}';
```

**Aviso obrigatório no relatório:** tornar o bucket privado quebra todos os URLs públicos já em circulação. A app tem de passar a usar `createSignedUrl()`. Dá o snippet:
```ts
const { data } = await supabase.storage
  .from('{bucket}')
  .createSignedUrl(path, 60);   // 60 segundos
```

---

# VIEW-001 — Vista que contorna RLS
### Severidade: Critical

Armadilha silenciosa: até ao Postgres 15, as vistas correm com os privilégios do criador. Uma vista sobre uma tabela protegida entrega os dados sem passar pelas políticas.

### Deteção
```sql
select c.relname as view_name,
       c.relkind,
       pg_get_userbyid(c.relowner) as owner,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       coalesce(
         (select option_value from pg_options_to_table(c.reloptions)
           where option_name = 'security_invoker'), 'false'
       ) as security_invoker,
       (select array_agg(distinct d.refobjid::regclass::text)
          from pg_depend d
         where d.objid = r.oid and d.classid = 'pg_rewrite'::regclass
           and d.refobjid <> c.oid) as source_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_rewrite r on r.ev_class = c.oid
where n.nspname = 'public'
  and c.relkind in ('v','m');
```

Finding se: `security_invoker = 'false'` **e** `anon_select = true` **e** alguma das `source_tables` tem `relrowsecurity = true`.

Materialized views (`relkind = 'm'`) **não suportam** `security_invoker` de todo — se estiverem acessíveis a `anon` e derivarem de tabela protegida, é sempre **Critical**.

### Remediação
```sql
-- Postgres 15+ (todos os projetos Supabase novos)
alter view public.{view} set (security_invoker = true);

-- Alternativa universal
revoke all on public.{view} from anon, authenticated;
```

Para materialized views não há `security_invoker`. A única correção é revogar o acesso e servir os dados por uma função `SECURITY INVOKER` ou por uma tabela com RLS.

---

# CLIENT-001 — Chave `service_role` exposta no cliente
### Severidade: Critical · Só corre em domínio verificado

### Deteção
Só executa se `ctx.verifiedDomain !== null`.

1. `GET https://{verifiedDomain}/` → HTML
2. Extrai `src` de todos os `<script>` e os `href` de `<link rel="modulepreload">`. Limita a 40 ficheiros e 5 MB no total (proteção de custo).
3. Descarrega cada bundle. Procura:

**Formato JWT (chaves legacy):**
```ts
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

for (const token of html.match(JWT) ?? []) {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString()
  );
  if (payload.role === 'service_role') → CRITICAL
  if (payload.role === 'anon') → normal, é suposto estar aqui
}
```

**Formato novo (API keys do Supabase, 2025+):**
```ts
/sb_secret_[A-Za-z0-9_-]{20,}/    → CRITICAL
/sb_publishable_[A-Za-z0-9_-]{20,}/  → normal
```

4. **Nunca guardes a chave encontrada.** No `evidence` guarda: ficheiro, offset, primeiros 8 caracteres, e o `role` extraído. Nada mais.

### Remediação
Não há SQL. Passos:
1. Rodar imediatamente a `service_role` key no dashboard Supabase (Settings → API → Reset)
2. Remover a variável do código cliente. Em Next.js, qualquer variável com prefixo `NEXT_PUBLIC_` vai para o browser — a `service_role` **nunca** pode ter esse prefixo.
3. Mover as operações que precisavam dela para Route Handlers, Server Actions ou Edge Functions
4. Redeploy
5. Assumir que a chave está comprometida: rever logs de acesso, verificar alterações inesperadas em dados
6. Re-scan para confirmar

---

# CLIENT-002 — Segredos de terceiros no bundle
### Severidade: Critical · Só corre em domínio verificado

### Padrões
```ts
const SECRETS = [
  { name: 'Stripe secret key',     re: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe restricted key', re: /rk_live_[A-Za-z0-9]{20,}/ },
  { name: 'Resend API key',        re: /\bre_[A-Za-z0-9]{20,}/ },
  { name: 'Anthropic API key',     re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI API key',        re: /sk-(proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: 'AWS access key',        re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Google API key',        re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Twilio API key',        re: /\bSK[0-9a-fA-F]{32}\b/ },
  { name: 'SendGrid API key',      re: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
  { name: 'GitHub token',          re: /gh[pousr]_[A-Za-z0-9]{36}/ },
  { name: 'Slack token',           re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Private key block',     re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];
```

### Falsos positivos
`sk_test_`, `pk_live_`, `pk_test_`, `AIza...` de Firebase (a API key do Firebase é pública por design) — exclui explicitamente. O padrão OpenAI genérico é o mais ruidoso; exige contexto (`apiKey`, `Authorization`, `Bearer`) num raio de 100 caracteres antes de reportar.

Endpoints a testar também (só no domínio verificado, só `HEAD`):
```
/.env  /.env.local  /.env.production
/.git/config  /.git/HEAD
/config.json  /appsettings.json
/api/debug  /api/health?verbose=true
```
`200` em qualquer um → **Critical** (`.env`, `.git`) ou **High** (o resto).

### Remediação
Por cada segredo: rodar a chave no fornecedor → remover do código → mover para variável de ambiente do servidor → redeploy → verificar faturação do fornecedor por uso indevido.

---

# EF-001 — Edge Function com `service_role` sem verificar o chamador
### Severidade: Critical · Requer OAuth (Management API)

### Deteção
```
GET https://api.supabase.com/v1/projects/{ref}/functions
  Authorization: Bearer {mgmtToken}
```
Devolve `slug`, `verify_jwt`, `status`, `version`.

Para cada função:
```
GET https://api.supabase.com/v1/projects/{ref}/functions/{slug}/body
```

Análise do corpo:
```ts
const usesServiceRole =
  /SUPABASE_SERVICE_ROLE_KEY|service_role/.test(body);

const verifiesCaller =
  /getUser\s*\(/.test(body) ||
  /auth\.getUser/.test(body) ||
  /verify(Webhook|Signature)/i.test(body) ||
  /createHmac|timingSafeEqual|constructEvent/.test(body);

if (usesServiceRole && fn.verify_jwt === false && !verifiesCaller) → CRITICAL
if (usesServiceRole && !verifiesCaller) → HIGH
```

Também: `Access-Control-Allow-Origin: *` combinado com leitura do header `Authorization` → **High**.

### Remediação
Template a devolver no relatório:
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // Cliente com o JWT do chamador — valida quem é
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  // Só agora escala privilégios, e só para o que este utilizador pode fazer
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  // ... operação restrita a user.id
});
```

Para webhooks (sem JWT), verificação HMAC obrigatória:
```ts
const sig = req.headers.get('x-signature');
const raw = await req.text();
const expected = createHmac('sha256', Deno.env.get('WEBHOOK_SECRET')!)
  .update(raw).digest('hex');
if (!timingSafeEqual(Buffer.from(sig ?? ''), Buffer.from(expected)))
  return new Response('Invalid signature', { status: 401 });
```

---

# AUTH-001 — Confirmação de email desativada com signup aberto
### Severidade: Critical quando combinado

Sozinha é High. Passa a Critical quando: confirmação desativada **e** existe alguma política RLS que confia em `auth.uid()` para acesso a dados de outros (ex.: tabela `profiles` legível por qualquer autenticado). Nesse caso, qualquer pessoa cria conta com email falso e entra.

### Deteção
```
GET https://api.supabase.com/v1/projects/{ref}/config/auth
  Authorization: Bearer {mgmtToken}
```

Verifica:
| Campo | Condição de finding |
|---|---|
| `mailer_autoconfirm` | `true` → confirmação desativada |
| `disable_signup` | `false` + heurística de app privada |
| `uri_allow_list` | contém `*` ou `http://` não-localhost |
| `jwt_exp` | `> 86400` |
| `password_min_length` | `< 8` |
| `security_update_password_require_reauthentication` | `false` |
| `password_hibp_enabled` (Pro) | `false` |

**Heurística de app privada:** existe tabela `invitations`, `invites`, `team_members`, `organization_members` ou `memberships` → a app é por convite → signup público aberto é finding.

Sem OAuth não consegues ler esta configuração. Nesse caso mostra a regra como **"Não verificada — requer ligação OAuth"** no relatório. Isto é um bom empurrão de conversão para o OAuth.

### Remediação
Passos no dashboard (Authentication → Providers / URL Configuration):
1. Ativar "Confirm email"
2. Remover wildcards da lista de redirect URLs; listar cada URL exato
3. JWT expiry para 3600s
4. Ativar proteção contra passwords comprometidas
5. Se a app é por convite, desativar signup público e usar `inviteUserByEmail()` do lado do servidor

---

## ORDEM DE EXECUÇÃO E ORÇAMENTO DE TEMPO

O scan tem de caber em 60s. Ordem:

| # | Regra | Custo | Notas |
|---|---|---|---|
| 1 | RLS-001, RLS-002, RLS-003, FN-001, GRANT-001, VIEW-001, PII-001 | ~2s | Uma única ronda de queries ao catálogo. Faz **todas** as queries em paralelo com `Promise.all`. |
| 2 | STO-001 | ~1s | Só catálogo + contagens |
| 3 | AUTH-001, EF-001 | ~3s | Management API, só com OAuth |
| 4 | ANON-001 | ~15s | HEAD por tabela. Concorrência 8. **Timeout de 3s por tabela**, e limite de 200 tabelas. |
| 5 | CLIENT-001, CLIENT-002 | ~20s | O mais lento. Limita a 40 ficheiros / 5 MB. Se estourar, marca o scan como `partial` e diz-lhe porquê. |

Se o total exceder 45s, escreve os findings já obtidos, marca `status = 'partial'`, e agenda um sub-job para o resto. Nunca deixes o utilizador com um scan falhado e zero informação.

---

## FIXTURES DE TESTE

Cria dois ficheiros SQL em `/test/fixtures/`:

**`vulnerable.sql`** — um projeto que dispara as 12 regras: tabela `profiles` sem RLS com coluna `email`, política `for all using (auth.uid()=user_id) with check (true)` em `orders`, função `SECURITY DEFINER` sem `search_path`, `grant create on schema public to anon`, bucket público `documents`, vista `user_stats` sem `security_invoker`.

**`secure.sql`** — o mesmo schema, corrigido. **Zero findings.** Este é o teste que importa: se `secure.sql` produzir um único finding, tens um falso positivo e não podes lançar.

Corre ambos em CI contra um Postgres em Docker com as roles `anon`, `authenticated`, `service_role` criadas.

---

## O QUE FAZER PRIMEIRO

1. Implementa **ANON-001** sozinha. Aponta-a ao Buildflow. Se apanhar zero tabelas expostas, a tua auditoria anterior está confirmada — e tens o primeiro testemunho real do produto.
2. Depois RLS-001 → RLS-002 → RLS-003 → PII-001. Estas cinco já dão um relatório que vale 29€/mês.
3. FN-001 e GRANT-001 a seguir — são as que impressionam quem percebe de Postgres, e as que ninguém mais deteta bem.
4. CLIENT-001/002 por último na Fase 1. São as mais espetaculares no marketing mas as mais frágeis tecnicamente.
