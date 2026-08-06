/**
 * Conteúdo das 31 páginas /docs/rules/[ruleId] (PROJECT_SPEC § 7/10 —
 * "motor de SEO/GEO"). Em inglês de propósito: o próprio spec dá um
 * exemplo de pesquisa em inglês ("supabase rls policy without with
 * check") — é a audiência que estas páginas visam, ao contrário do resto
 * da app (Português-PT). `summary` são as 40–60 palavras citáveis por
 * motores de IA, no topo de cada página.
 */
export interface RuleDoc {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  summary: string;
  explanation: string;
  vulnerable: string;
  fixed: string;
}

export const RULE_DOCS: RuleDoc[] = [
  {
    id: "RLS-001",
    title: "RLS disabled on a public schema table",
    severity: "critical",
    category: "Row Level Security",
    summary:
      "RLS-001 fires when a table in the public schema is reachable by the anon or authenticated API role but has Row Level Security turned off. Without RLS, PostgREST enforces no row-level access control at all — any request with the anon key can read or write every row. Fix: enable and force RLS, then add a policy.",
    explanation:
      "Supabase exposes every table in `public` through PostgREST unless Row Level Security is enabled. When RLS is off, the database has no row-level access control — Postgres treats every row as globally visible to any role Supabase grants API access to, which by default includes `anon`. This is the single most common way AI-generated Supabase apps leak data: the table works fine in local testing (where the developer is usually using the service_role key or bypassing RLS), then ships to production wide open.",
    vulnerable: `-- orders is reachable via the API, RLS is off
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  total numeric
);
-- no "alter table ... enable row level security" anywhere`,
    fixed: `alter table public.orders enable row level security;
alter table public.orders force row level security; -- applies to the table owner too

create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);`,
  },
  {
    id: "RLS-002",
    title: "Read policy fully open to anonymous users",
    severity: "critical",
    category: "Row Level Security",
    summary:
      "RLS-002 flags SELECT policies with USING (true) granted to the anon role — RLS is technically \"on,\" but the policy imposes no restriction, so it behaves identically to having no RLS at all. This is the most common false sense of security in Supabase apps: a checkbox is ticked, but the data is still fully public.",
    explanation:
      "Enabling RLS is only half the job — the policy itself has to actually restrict rows. `using (true)` is a policy that matches every row for every caller, so an anon-scoped SELECT policy with that expression is functionally the same as no RLS. This usually happens when a developer (or an AI coding assistant) adds a policy purely to make a Supabase error message go away, without thinking through who should see what.",
    vulnerable: `create policy "anyone_can_read"
  on public.profiles
  for select
  to anon
  using (true);`,
    fixed: `drop policy if exists "anyone_can_read" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);`,
  },
  {
    id: "RLS-003",
    title: "WITH CHECK more permissive than USING (privilege escalation)",
    severity: "critical",
    category: "Row Level Security",
    summary:
      "RLS-003 catches policies where the WITH CHECK expression (what you're allowed to write) is looser than USING (what you're allowed to read/see). A user can then write rows they could never read back — commonly used to escalate a role column, attach someone else's user_id, or plant rows outside their own scope, all while the SELECT policy looks correctly locked down.",
    explanation:
      "USING and WITH CHECK do different jobs on the same policy: USING filters which existing rows a statement can touch, WITH CHECK validates the row's final state after an INSERT or UPDATE. If WITH CHECK is missing or weaker than USING, Postgres falls back to USING for both — meaning a policy that reads `auth.uid() = user_id` but has no separate WITH CHECK will happily let an authenticated user insert a row with someone else's `user_id`.",
    vulnerable: `create policy "orders_update_own" on public.orders
  for update
  to authenticated
  using (auth.uid() = user_id);
  -- no WITH CHECK — user can update the row and change user_id to anyone`,
    fixed: `create policy "orders_update_own" on public.orders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`,
  },
  {
    id: "RLS-006",
    title: "Policy trusts an HTTP header instead of auth.uid()",
    severity: "high",
    category: "Row Level Security",
    summary:
      "RLS-006 flags policies that derive identity from a client-supplied HTTP header (e.g. current_setting('request.headers')::json->>'x-user-id') instead of auth.uid(). Any caller can set arbitrary headers on their own request, so a policy built this way grants access as literally anyone the attacker claims to be — it looks like row-level security but authenticates nothing.",
    explanation:
      "`auth.uid()` is derived from the verified JWT that Supabase Auth issues and signs — it can't be forged without the project's JWT secret. Request headers, on the other hand, are fully controlled by whoever sends the HTTP request. A policy that reads an identity claim out of a header instead of the JWT is trivially bypassed: `curl -H \"x-user-id: <anyone>\"` impersonates any account.",
    vulnerable: `create policy "messages_select_own" on public.messages
  for select
  using (
    user_id = (current_setting('request.headers', true)::json ->> 'x-user-id')::uuid
  );`,
    fixed: `create policy "messages_select_own" on public.messages
  for select
  to authenticated
  using (auth.uid() = user_id);`,
  },
  {
    id: "RLS-007",
    title: "A single FOR ALL policy instead of per-operation policies",
    severity: "medium",
    category: "Row Level Security",
    summary:
      "RLS-007 flags tables that use one FOR ALL policy to cover SELECT/INSERT/UPDATE/DELETE at once. It's not automatically a vulnerability, but it makes it easy for a USING/WITH CHECK mismatch to slip through unnoticed, since the same expression is silently reused for every operation. Splitting into per-operation policies makes each permission boundary explicit and independently reviewable.",
    explanation:
      "A `for all` policy applies the same USING (and, if present, WITH CHECK) expression to every command type. That's convenient to write, but it hides the fact that SELECT, INSERT, UPDATE and DELETE usually need different rules — for instance, a user might be allowed to read their own row but never delete it. Splitting the policy by operation is a readability and audit fix as much as a security one.",
    vulnerable: `create policy "notes_all" on public.notes
  for all
  using (auth.uid() = user_id);`,
    fixed: `create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = user_id);`,
  },
  {
    id: "ANON-001",
    title: "Table readable by an anonymous user",
    severity: "critical",
    category: "Anonymous access",
    summary:
      "ANON-001 confirms real-world exposure: it sends a HEAD request to a table's PostgREST endpoint using only the public anon key and reads the row count Supabase returns, without ever reading row content. If the count is greater than zero, an unauthenticated visitor can read that table right now — this is the rule that turns a policy misconfiguration into a proven, demonstrable leak.",
    explanation:
      "Every other rule in this catalog inspects configuration — RLS status, policy expressions, grants. ANON-001 is different: it's a live confirmation probe. It calls the table's REST endpoint with `Prefer: count=exact` and the anon key, reading only the `Content-Range` response header for a row count — never the response body, so no customer data is ever read or stored. A non-zero count means the exposure is real, not theoretical.",
    vulnerable: `-- curl -I "https://<ref>.supabase.co/rest/v1/customers?select=*" -H "apikey: <anon key>"
-- HTTP/2 200
-- content-range: 0-9/1240   <- 1240 rows readable by anyone`,
    fixed: `alter table public.customers enable row level security;
alter table public.customers force row level security;
-- re-run the probe: expect HTTP 200 with content-range 0-*/0 for anon`,
  },
  {
    id: "PII-001",
    title: "Table with personal data has no protection",
    severity: "critical",
    category: "Personal data",
    summary:
      "PII-001 flags tables whose columns look like personal data (email, phone, address, name, date of birth, national ID patterns) that have no RLS at all. It's a targeted variant of RLS-001, weighted critical whenever the exposed table clearly contains data about real people rather than app configuration — the kind of finding that turns into a breach-notification obligation.",
    explanation:
      "Not every unprotected table is equally bad — a `feature_flags` table with no RLS is sloppy; a `customers` table with `email`, `phone` and `address` columns and no RLS is a data-protection incident waiting to happen. This rule matches column names against common PII patterns and cross-references tables that have RLS disabled, so the report can prioritize what actually contains personal data first.",
    vulnerable: `create table public.customers (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  address text
);
-- rls never enabled`,
    fixed: `alter table public.customers enable row level security;

create policy "customers_select_own"
  on public.customers for select
  to authenticated
  using (auth.uid() = id);

revoke all on public.customers from anon;`,
  },
  {
    id: "GRANT-001",
    title: "Excessive privileges on the public schema",
    severity: "critical",
    category: "Grants",
    summary:
      "GRANT-001 checks table-level Postgres GRANTs — independent of RLS — for dangerous privileges held by anon, most critically TRUNCATE (wipes a whole table in one statement, RLS provides no protection against it) and broad INSERT/UPDATE/DELETE on tables without RLS. RLS restricts rows; GRANTs restrict operations, and Supabase's default grants are wide enough that a forgotten table stays fully writable.",
    explanation:
      "Row Level Security and SQL GRANTs are two separate access-control layers, and Supabase templates default the `anon` and `authenticated` roles to broad table grants so PostgREST can do its job — RLS is meant to be the layer that actually restricts what's visible or writable. If a table never gets RLS enabled, the underlying grants are exactly as permissive as they look: `anon` can `truncate`, `delete`, or blind-insert into it.",
    vulnerable: `-- default Supabase grant, no RLS on this table
grant truncate, delete, insert, update on public.logs to anon;`,
    fixed: `revoke all on public.logs from anon;
alter table public.logs enable row level security;
alter table public.logs force row level security;`,
  },
  {
    id: "VIEW-001",
    title: "A view that bypasses RLS",
    severity: "critical",
    category: "Views",
    summary:
      "VIEW-001 catches views over an RLS-protected table that are readable by anon/authenticated but run with the view owner's privileges instead of the caller's — a classic way RLS gets silently bypassed. Postgres views default to the creator's permissions, so a view can expose every row of a locked-down table unless it's explicitly marked security_invoker.",
    explanation:
      "By default, a Postgres view runs with the privileges of whoever created it, not the privileges of whoever queries it — Postgres 15 introduced `security_invoker` specifically to fix this. A view built on top of an RLS-protected table, without that flag, silently re-exposes every row to anyone who can query the view, defeating the RLS policy on the underlying table entirely.",
    vulnerable: `create view public.all_orders as
  select * from public.orders; -- owner (postgres) bypasses orders' RLS`,
    fixed: `alter view public.all_orders set (security_invoker = true);
revoke all on public.all_orders from anon, authenticated;`,
  },
  {
    id: "FN-001",
    title: "SECURITY DEFINER function without a fixed search_path",
    severity: "critical",
    category: "Functions",
    summary:
      "FN-001 flags SECURITY DEFINER functions (which run with the owner's — usually postgres — privileges) that don't pin search_path. Without it, the function resolves unqualified object names using the caller's search_path, so a malicious caller can create a same-named object earlier in the path and hijack the function's execution to run arbitrary code as the owner.",
    explanation:
      "`SECURITY DEFINER` is what lets a Postgres function do privileged work on behalf of a lower-privileged caller — it's essential for patterns like \"let any authenticated user call a function that updates a table they don't have direct UPDATE rights to.\" The danger is schema hijacking: if the function references `some_table` without a schema prefix and doesn't fix `search_path`, a caller can create their own `some_table` earlier in the resolution path and have the definer-privileged function operate on it instead.",
    vulnerable: `create function public.promote_user(uid uuid)
returns void
language plpgsql
security definer
as $$
begin
  update profiles set role = 'admin' where id = uid; -- unqualified, no search_path
end;
$$;`,
    fixed: `alter function public.promote_user(uuid) set search_path = '';
-- or, less strict but still safe:
-- alter function public.promote_user(uuid) set search_path = public, pg_temp;`,
  },
  {
    id: "FN-003",
    title: "Function writes to the database without validating auth.uid()",
    severity: "high",
    category: "Functions",
    summary:
      "FN-003 flags SECURITY DEFINER functions that perform INSERT/UPDATE/DELETE but never reference auth.uid() anywhere in the function body — meaning there's no way the write is actually scoped to the calling user. If the function is callable via RPC by anon or authenticated, any caller can trigger the write for arbitrary rows, regardless of who they are.",
    explanation:
      "Because SECURITY DEFINER functions execute with elevated privileges, they're expected to enforce their own authorization internally — RLS on the underlying table doesn't help, since the function runs as the owner. A function that writes data but never checks `auth.uid()` (or an equivalent check) against the row being modified effectively lets any authenticated caller act on behalf of any user.",
    vulnerable: `create function public.delete_note(note_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.notes where id = note_id; -- no ownership check
end;
$$;`,
    fixed: `create function public.delete_note(note_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.notes where id = note_id and user_id = auth.uid()
  ) then
    raise exception 'unauthorized';
  end if;
  delete from public.notes where id = note_id;
end;
$$;`,
  },
  {
    id: "FN-005",
    title: "Trigger propagates unauthenticated input to a table with personal data",
    severity: "medium",
    category: "Functions",
    summary:
      "FN-005 flags triggers on tables writable by anon that copy data into a second table containing personal-data columns. Even if the source table itself looks harmless, an anonymous submission can end up populating a PII table through the trigger — an indirect exposure path that a review of RLS policies alone won't catch, because the write target is never queried directly by the client.",
    explanation:
      "Triggers run inside the database and aren't subject to RLS the way a direct API call is, so a chain like \"anon can insert into `contact_requests`\" → \"trigger copies the row into `customers`\" can move data into a sensitive table without that table ever being exposed via PostgREST directly. This rule follows that chain and flags it when the destination table has PII-shaped columns.",
    vulnerable: `-- contact_requests is insertable by anon
create trigger sync_customer
after insert on public.contact_requests
for each row execute function public.copy_to_customers();
-- copy_to_customers() writes name/email/phone into public.customers`,
    fixed: `-- validate and sanitize inside copy_to_customers(), and/or
alter table public.customers enable row level security;
-- so even if the trigger writes a row, exposure via the API stays controlled`,
  },
  {
    id: "FN-006",
    title: "Extension installed in the public schema",
    severity: "low",
    category: "Functions",
    summary:
      "FN-006 flags Postgres extensions installed into the public schema instead of a dedicated extensions schema. It's mostly a hygiene issue — extension functions and objects mix into the same namespace as application tables, increasing the odds of a name collision or of an extension-provided function being unexpectedly reachable through PostgREST's schema exposure.",
    explanation:
      "Supabase (and Postgres in general) recommends keeping extensions out of `public` so application objects and extension-provided objects don't share a namespace. It's rarely an exploitable vulnerability on its own, but it's cheap to fix and removes a category of accidental collisions and unexpected API exposure as a project grows.",
    vulnerable: `create extension "pg_trgm" with schema public;`,
    fixed: `drop extension if exists "pg_trgm";
create extension "pg_trgm" with schema extensions;`,
  },
  {
    id: "STO-001",
    title: "Public bucket with sensitive files",
    severity: "critical",
    category: "Storage",
    summary:
      "STO-001 flags Storage buckets marked public that contain files with names suggesting personal documents (invoice, passport, id, contract, etc.). A public bucket serves every object to anyone with the URL, no auth required — file naming patterns are the fastest signal that a bucket meant for avatars or logos has, over time, accumulated something it shouldn't.",
    explanation:
      "Supabase Storage buckets have a simple public/private flag: public buckets serve objects to anyone who has (or guesses) the URL, with zero authentication. Buckets often start public for a legitimate reason — public avatars, marketing assets — and then accumulate sensitive uploads as the app grows, without anyone revisiting the bucket's visibility setting.",
    vulnerable: `update storage.buckets set public = true where id = 'user-documents';
-- files like invoice-2026-jan.pdf, passport-scan.jpg now served with no auth`,
    fixed: `update storage.buckets set public = false where id = 'user-documents';

create policy "user_documents_read_own"
  on storage.objects for select
  using (bucket_id = 'user-documents' and (storage.foldername(name))[1] = auth.uid()::text);`,
  },
  {
    id: "STO-003",
    title: "Bucket without adequate storage policies",
    severity: "high",
    category: "Storage",
    summary:
      "STO-003 flags private buckets that either have zero storage.objects policies (nobody can access anything, which is a functional bug, not a leak) or a policy that filters only by bucket_id without checking ownership or folder path — meaning any authenticated user can read every other user's files in that bucket.",
    explanation:
      "Private buckets rely entirely on `storage.objects` RLS policies for access control — there's no separate per-bucket permission layer beyond that. A policy that reads `using (bucket_id = 'avatars')` and nothing else grants every authenticated user access to every file in the bucket, not just their own; ownership needs to be checked explicitly, usually against the file's folder path.",
    vulnerable: `create policy "avatars_read" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars'); -- any authenticated user reads any user's file`,
    fixed: `drop policy if exists "avatars_read" on storage.objects;

create policy "avatars_read_own" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);`,
  },
  {
    id: "STO-004",
    title: "Bucket without a file size limit",
    severity: "medium",
    category: "Storage",
    summary:
      "STO-004 flags buckets with no file_size_limit configured. Anyone with write access can upload arbitrarily large files, which is a straightforward denial-of-service and cost vector against a project's storage quota and bandwidth — especially dangerous on buckets that accept unauthenticated or lightly-authenticated uploads.",
    explanation:
      "Supabase Storage buckets support a `file_size_limit` column that Supabase enforces server-side. Leaving it unset means the only ceiling is the project-wide plan limit, so a single abusive upload (or a scripted flood of them) can consume a large share of a project's storage allowance or bandwidth before anyone notices.",
    vulnerable: `-- bucket 'uploads' has file_size_limit = null`,
    fixed: `update storage.buckets set file_size_limit = 10485760 where id = 'uploads'; -- 10 MB, adjust to your use case`,
  },
  {
    id: "STO-005",
    title: "Bucket without file type restrictions (allowed_mime_types)",
    severity: "medium",
    category: "Storage",
    summary:
      "STO-005 flags buckets that accept any MIME type, including HTML and SVG. Both can carry executable script; served from a bucket without a restrictive Content-Type/allowed_mime_types policy, they become a stored XSS vector — especially dangerous if the bucket is public or the uploader can influence the download context.",
    explanation:
      "SVG files can embed `<script>` tags, and HTML files are of course scripts by definition — Supabase Storage will happily serve either back with their original content type unless `allowed_mime_types` restricts uploads. A bucket meant for profile pictures that also accepts `.svg` or `.html` gives an attacker a way to plant a payload that executes in the context of whoever opens the file.",
    vulnerable: `-- bucket 'avatars' has allowed_mime_types = null (anything accepted)`,
    fixed: `update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars'; -- adjust to the types this bucket actually needs`,
  },
  {
    id: "AUTH-001",
    title: "Email confirmation disabled / weak auth configuration",
    severity: "high",
    category: "Auth configuration",
    summary:
      "AUTH-001 checks Supabase Auth project settings via the Management API for signals of weak configuration: email confirmation disabled while a members/invites table exists, an overly permissive redirect URL allow-list, JWT expiry over 24h, or a weak minimum password length — each a real account-takeover or session-hijack risk on its own.",
    explanation:
      "Supabase Auth ships secure defaults, but several settings are easy to loosen while debugging and easy to forget to re-tighten: disabling \"confirm email\" to speed up local testing, widening the redirect URL allow-list to unblock an OAuth callback, or lowering the minimum password length. This rule reads the project's live auth config through the Management API (it needs an OAuth connection, not just database credentials) and flags each weak setting independently.",
    vulnerable: `-- Auth settings via Management API
{ "mailer_autoconfirm": true, "uri_allow_list": "*", "jwt_exp": 604800, "password_min_length": 4 }`,
    fixed: `-- Authentication → Settings in the Supabase dashboard:
-- Confirm email: on · Redirect URLs: exact list, no wildcards
-- JWT expiry: <= 3600s · Minimum password length: >= 8`,
  },
  {
    id: "AUTH-006",
    title: "No MFA provider active",
    severity: "low",
    category: "Auth configuration",
    summary:
      "AUTH-006 flags projects with no multi-factor authentication provider enabled. It's an account-hardening recommendation more than a direct vulnerability: without MFA, a leaked or guessed password is immediately sufficient to take over an account, with no second factor to stop it.",
    explanation:
      "Supabase Auth supports TOTP-based MFA out of the box. Enabling it doesn't force every user to set it up (that's a separate app-level decision), but it makes the option available — a prerequisite for offering stronger account security to users who want it, and increasingly expected by security-conscious B2B customers doing due diligence on a vendor.",
    vulnerable: `-- Authentication → Providers → Multi-Factor Authentication: all disabled`,
    fixed: `-- Enable at least TOTP in Authentication → Providers → Multi-Factor Authentication.`,
  },
  {
    id: "AUTH-007",
    title: "service_role key not rotated in over 365 days",
    severity: "low",
    category: "Auth configuration",
    summary:
      "AUTH-007 flags service_role keys that haven't been rotated in over a year. The service_role key bypasses RLS entirely by design, so the longer a given key has existed, the larger the window in which it could have been copied into a log file, a client bundle, a chat message, or a leaked .env — without anyone finding out.",
    explanation:
      "The service_role key is the single most powerful credential in a Supabase project — it bypasses every RLS policy. Supabase doesn't expire it automatically, so a key generated at project creation can live unchanged for years. Periodic rotation limits the blast radius of any copy of the key that leaked at some point without being noticed (see CLIENT-001 for the most common way that happens).",
    vulnerable: `-- service_role key last rotated: 412 days ago`,
    fixed: `-- Settings → API → Reset service_role key, then update it everywhere it's stored
-- (Vercel env vars, CI secrets, local .env files, third-party integrations).`,
  },
  {
    id: "EF-001",
    title: "Edge Function using service_role without verifying the caller",
    severity: "critical",
    category: "Edge Functions",
    summary:
      "EF-001 flags Edge Functions that use the service_role key (bypassing RLS by design) but have verify_jwt disabled and don't independently check who's calling — meaning the function's elevated privileges are reachable by anyone who can send it an HTTP request, with no identity check anywhere in the path.",
    explanation:
      "Edge Functions with `verify_jwt = false` are reachable by unauthenticated requests at the platform level — that's a legitimate pattern for public webhooks, but it's dangerous the moment the function also holds a `service_role` client, since that combination means \"anyone on the internet gets RLS-bypassing database access, gated by nothing.\" The function needs to verify the caller itself if the platform isn't doing it.",
    vulnerable: `// verify_jwt = false in the function's config, and:
const supabase = createClient(url, Deno.env.get("SERVICE_ROLE_KEY")!);
// no check of the caller's identity anywhere in this function`,
    fixed: `import { createClient } from 'jsr:@supabase/supabase-js@2';

const authClient = createClient(url, anonKey, {
  global: { headers: { Authorization: req.headers.get('Authorization')! } },
});
const { data: { user }, error } = await authClient.auth.getUser();
if (error || !user) return new Response('Unauthorized', { status: 401 });
// only now use the service_role client, scoped to what "user" is allowed to do`,
  },
  {
    id: "EF-002",
    title: "Webhook without HMAC signature verification",
    severity: "high",
    category: "Edge Functions",
    summary:
      "EF-002 flags Edge Functions that look like webhook receivers (Stripe, GitHub, etc.) but don't verify the provider's signature header before trusting the payload. Without signature verification, anyone who finds the endpoint URL can forge events — fake a paid subscription, a completed order, or any other state change the webhook is meant to drive.",
    explanation:
      "Webhook endpoints are public by necessity — the third-party provider needs to reach them without authentication. The provider's signature (an HMAC over the raw body, using a secret only the two parties know) is the only thing standing between \"this is a real event from Stripe\" and \"this is a curl request from anyone.\" Skipping that check turns a webhook into an open write endpoint.",
    vulnerable: `Deno.serve(async (req) => {
  const event = await req.json(); // trusted with zero verification
  if (event.type === 'checkout.session.completed') {
    await markOrderPaid(event.data.object.id);
  }
});`,
    fixed: `import Stripe from 'npm:stripe';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();
  const event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  // only trust "event" from here on
});`,
  },
  {
    id: "EF-004",
    title: "Open CORS on a function that accepts credentials",
    severity: "medium",
    category: "Edge Functions",
    summary:
      "EF-004 flags Edge Functions that set Access-Control-Allow-Origin: * while also reading the Authorization header or cookies — that combination lets any website make authenticated requests to the function on behalf of a logged-in user who simply visits a malicious page, a classic CSRF-via-CORS pattern.",
    explanation:
      "A wildcard CORS origin is safe for a public, unauthenticated endpoint. It stops being safe the moment the function trusts an `Authorization` header or a cookie to identify the caller, because any website can now trigger a browser to send that same credential to the function on the victim's behalf — the browser doesn't know the target site is untrusted, only that CORS allowed it.",
    vulnerable: `return new Response(JSON.stringify(data), {
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true' },
});`,
    fixed: `const allowedOrigins = ['https://app.example.com'];
const origin = req.headers.get('origin');
const headers = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin ?? '') ? origin! : allowedOrigins[0],
  'Access-Control-Allow-Credentials': 'true',
};`,
  },
  {
    id: "GEN-001",
    title: "PITR backups disabled on a paid-plan project",
    severity: "medium",
    category: "Hygiene",
    summary:
      "GEN-001 flags paid-plan projects with Point-in-Time Recovery disabled. Without PITR, recovery from a destructive mistake — a bad migration, an accidental mass DELETE, a compromised credential used to wipe data — is limited to the last daily backup, meaning up to 24 hours of data can be unrecoverable.",
    explanation:
      "Paid Supabase plans include PITR as an available add-on or included feature, letting you restore the database to any point within the retention window instead of only to the last nightly snapshot. It's disabled by default on new projects and easy to forget to turn on, which only becomes visible as a problem during an actual incident.",
    vulnerable: `-- Settings → Database → Backups: Point-in-Time Recovery: disabled`,
    fixed: `-- Enable Point-in-Time Recovery in Settings → Database → Backups.`,
  },
  {
    id: "GEN-002",
    title: "Column used in an RLS policy has no index",
    severity: "low",
    category: "Hygiene",
    summary:
      "GEN-002 flags columns referenced by an RLS policy's USING/WITH CHECK expression that have no index. It's a performance finding, not a security one: Postgres evaluates the policy expression for every row scanned, so a policy filtering on an unindexed column forces a sequential scan on every request through that table.",
    explanation:
      "RLS policies are just additional WHERE-clause-like filters applied automatically by Postgres — and like any filter, they benefit from an index on the columns they reference. A policy like `using (auth.uid() = user_id)` on a large, unindexed `user_id` column turns every single API request against that table into a full table scan, which gets slower as the table grows.",
    vulnerable: `-- policy filters on public.orders(user_id), no index on that column`,
    fixed: `create index if not exists orders_user_id_idx on public.orders (user_id);`,
  },
  {
    id: "GEN-003",
    title: "Orphaned table with personal data, unused for 90+ days",
    severity: "low",
    category: "Hygiene",
    summary:
      "GEN-003 flags tables containing PII-shaped columns that show no read activity in Postgres statistics for 90+ days. Data you no longer use but still store is pure downside under data-minimization principles (GDPR Article 5) — it's retained risk with no offsetting product value, and the easiest fix is often simply archiving or deleting it.",
    explanation:
      "Every table holding personal data that's actually queried is at least earning its risk by doing something. A table with email/name/phone-shaped columns and zero reads for three months is a pure liability: it's still a target if credentials leak, it's still in scope for a data subject access request, and it's providing no value in exchange. This rule surfaces those tables using Postgres's own access statistics.",
    vulnerable: `-- public.legacy_signups has email/phone columns, last read 140 days ago`,
    fixed: `-- Archive or export what's needed, then:
drop table if exists public.legacy_signups;
-- or, if it must be retained: alter table ... enable row level security; and restrict access explicitly`,
  },
  {
    id: "CLIENT-001",
    title: "service_role key exposed in the client",
    severity: "critical",
    category: "Client exposure",
    summary:
      "CLIENT-001 scans the shipped client-side JavaScript bundle for a Supabase service_role key — the credential that bypasses every RLS policy. Finding one means anyone who opens devtools on the live site has full, unrestricted database access, in both the legacy JWT-shaped key format and the newer sb_secret_ format.",
    explanation:
      "It's an easy mistake in projects generated by AI coding tools: the service_role key works great in local development (no RLS friction), so it ends up in a `NEXT_PUBLIC_*` env var or hardcoded directly in a client component to \"just make it work,\" and ships straight into the browser bundle. Anyone can extract it from the network tab or the bundle source and use it exactly like an admin.",
    vulnerable: `// shipped to the browser
const supabase = createClient(url, "eyJhbGciOiJIUzI1NiIs...service_role...");`,
    fixed: `// browser: anon key only
const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
// service_role key stays server-only (API route / Server Action / Edge Function env var)`,
  },
  {
    id: "CLIENT-002",
    title: "Third-party secrets in the bundle",
    severity: "critical",
    category: "Client exposure",
    summary:
      "CLIENT-002 scans the shipped client bundle for common secret patterns beyond Supabase itself — Stripe secret keys, generic API keys, and similar credential shapes. These are frequently pasted into client code during a quick integration and never moved server-side, and once shipped they're visible to anyone inspecting the site's JavaScript.",
    explanation:
      "The same failure mode that leaks a Supabase service_role key (CLIENT-001) applies to any other secret an AI coding assistant or a developer under time pressure wires up directly in client code — a Stripe secret key used to \"just call the API from the frontend,\" a third-party API key that should have stayed server-side. This rule pattern-matches known secret shapes in the built bundle.",
    vulnerable: `// shipped to the browser
const stripe = new Stripe("sk_live_51H..."); // secret key, not publishable`,
    fixed: `// browser: publishable key only (pk_live_...)
// secret key (sk_live_...) stays in a server-only env var, used from an API route`,
  },
  {
    id: "CLIENT-003",
    title: "Source maps published in production",
    severity: "medium",
    category: "Client exposure",
    summary:
      "CLIENT-003 checks whether production source maps are publicly served. Source maps reconstruct original, readable source code (including comments and variable names) from a minified bundle — useful for your own error monitoring, but if publicly accessible they hand an attacker a fully readable copy of your frontend logic, API call patterns, and any secrets embedded in it.",
    explanation:
      "Source maps are meant for debugging, not for public distribution — most tooling (Sentry included) supports uploading them privately to your error-tracking provider while keeping them out of the public build output. When they're left publicly accessible, anyone can pull `bundle.js.map` and read the application's original source, which makes finding client-side vulnerabilities (including CLIENT-001/002) trivially easier.",
    vulnerable: `-- GET /_next/static/chunks/main.js.map -> 200, full source map served publicly`,
    fixed: `// next.config.js
module.exports = { productionBrowserSourceMaps: false };
// or upload maps privately to your error tracker instead of serving them publicly`,
  },
  {
    id: "CLIENT-005",
    title: "Missing security headers",
    severity: "low",
    category: "Client exposure",
    summary:
      "CLIENT-005 checks the site's HTTP response headers for common baseline protections: a Content-Security-Policy, Strict-Transport-Security (HSTS), and clickjacking protection (X-Frame-Options or frame-ancestors). None of these are exploitable on their own, but their absence removes browser-level defenses that would otherwise blunt several classes of client-side attack.",
    explanation:
      "Security headers are cheap, framework-level defenses against attacks that originate somewhere else in the stack: CSP limits what a successful XSS payload can actually do, HSTS prevents protocol-downgrade attacks on the connection itself, and frame protections stop the site from being embedded in an invisible iframe for clickjacking. They cost nothing to add and are close to zero-risk to enable.",
    vulnerable: `-- response headers: no content-security-policy, no strict-transport-security`,
    fixed: `// next.config.js — add via headers()
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'Content-Security-Policy', value: "default-src 'self'; ..." }`,
  },
  {
    id: "CLIENT-006",
    title: "Database schema enumerable via PostgREST",
    severity: "high",
    category: "Client exposure",
    summary:
      "CLIENT-006 confirms that the anon key can list every table in the public schema through PostgREST's OpenAPI root endpoint — meaning an attacker doesn't need to guess table names before probing them for access (see ANON-001). This isn't exploitable on its own, but it removes the reconnaissance cost from every other attack in this catalog.",
    explanation:
      "PostgREST auto-generates an OpenAPI description of every table it exposes, available at the API root with just the anon key — this is a Supabase/PostgREST feature, not a bug, but it means the full table list is one unauthenticated request away. Combined with any RLS gap elsewhere, it turns a targeted guess into a systematic sweep: an attacker enumerates the schema first, then checks every table for anon access.",
    vulnerable: `-- curl "https://<ref>.supabase.co/rest/v1/" -H "apikey: <anon key>"
-- returns the full OpenAPI spec, including every table name in public`,
    fixed: `-- This is inherent to PostgREST's design — the real fix is making sure
-- every listed table actually has RLS enabled and correctly scoped (RLS-001..007),
-- so enumeration alone doesn't translate into access.`,
  },
];

export function getRuleDoc(ruleId: string): RuleDoc | undefined {
  return RULE_DOCS.find((r) => r.id === ruleId.toUpperCase());
}
