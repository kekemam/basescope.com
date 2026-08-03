/** Sondagem de domínio verificado, partilhada por CLIENT-001 e CLIENT-002. */

const MAX_FILES = 40;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

export interface FetchedBundle {
  path: string;
  content: string;
}

function extractBundleUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const scriptSrc = /<script[^>]+src=["']([^"']+)["']/gi;
  const modulePreload = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi;

  for (const re of [scriptSrc, modulePreload]) {
    for (const match of html.matchAll(re)) {
      const src = match[1];
      if (!src) continue;
      try {
        urls.add(new URL(src, baseUrl).toString());
      } catch {
        // ignora URLs inválidos
      }
    }
  }

  return [...urls].slice(0, MAX_FILES);
}

/**
 * Descarrega o HTML da página inicial e até 40 bundles JS/módulos
 * referenciados, com um limite total de 5 MB (proteção de custo). Só deve
 * ser chamado quando `verifiedDomain` está definido.
 */
export async function fetchBundlesForDomain(verifiedDomain: string): Promise<FetchedBundle[]> {
  const baseUrl = `https://${verifiedDomain}/`;
  const htmlRes = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
  if (!htmlRes.ok) return [];
  const html = await htmlRes.text();

  const bundles: FetchedBundle[] = [{ path: "/", content: html }];
  let totalBytes = html.length;

  for (const url of extractBundleUrls(html, baseUrl)) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const content = await res.text();
      totalBytes += content.length;
      bundles.push({ path: url, content });
    } catch {
      // bundle individual falhou — não aborta o scan inteiro
    }
  }

  return bundles;
}
