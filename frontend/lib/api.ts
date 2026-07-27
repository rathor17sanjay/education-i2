import type { Block } from "./blocks";

export const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "bmu";

export type TitlePayload = { title: string; subtitle: string };
export type BlocksPayload = {
  blocks: Block[];
  follow_up_chips: string[];
  insufficient_context: boolean;
  grounded: boolean;
};

export type TenantTheme = {
  logo_url: string | null;
  icon_url: string | null;
  brand_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  gtm_id: string | null;
  headline: string | null;
  subheadline: string | null;
};

/** Branding a superadmin set for this tenant (api/superadmin.py's theme
 * jsonb fields), fetched by slug. Falls back to an all-null theme (callers
 * fall back to the static defaults already baked into globals.css/public/)
 * rather than throwing -- a tenant with nothing configured yet, or a
 * network hiccup, shouldn't break the page. */
const _EMPTY_THEME: TenantTheme = {
  logo_url: null,
  icon_url: null,
  brand_name: null,
  primary_color: null,
  secondary_color: null,
  gtm_id: null,
  headline: null,
  subheadline: null,
};

/** Client-side (browser) fetch -- relative path, covered by the /api/:path*
 * rewrite in next.config.ts. Used from Client Components like QueryView. */
export async function fetchTenantTheme(): Promise<TenantTheme> {
  try {
    const res = await fetch(`/api/${TENANT_SLUG}/theme`, { cache: "no-store" });
    if (!res.ok) return _EMPTY_THEME;
    return await res.json();
  } catch {
    return _EMPTY_THEME;
  }
}

/** Server-side (Server Component) fetch -- there's no browser/current-origin
 * context during SSR for a relative URL to resolve against, so this calls
 * the backend directly (server-to-server, not subject to the mixed-content
 * restriction the rewrite exists for). Used once in the root layout so the
 * theme is baked into the initial HTML instead of flashing in after a
 * client-side fetch. */
export async function fetchTenantThemeServer(): Promise<TenantTheme> {
  const backendUrl = process.env.API_PROXY_TARGET ?? "http://159.223.72.11:8000";
  try {
    const res = await fetch(`${backendUrl}/api/${TENANT_SLUG}/theme`, { cache: "no-store" });
    if (!res.ok) return _EMPTY_THEME;
    return await res.json();
  } catch {
    return _EMPTY_THEME;
  }
}

/** Real recently-asked questions, for homepage starter chips. Falls back to
 * an empty list (caller supplies a hardcoded fallback) rather than
 * throwing -- a fresh tenant with an empty cache shouldn't break the page. */
export async function fetchPopularQuestions(limit = 4): Promise<string[]> {
  try {
    const res = await fetch(`/api/${TENANT_SLUG}/popular-questions?limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.questions ?? [];
  } catch {
    return [];
  }
}

/**
 * Two-phase streaming query: calls onTitle as soon as the fast title/subtitle
 * phase completes, then onBlocks once the fuller answer is ready -- mirrors
 * the "title renders fast, blocks populate progressively" pattern from the
 * Sharda AI benchmark in CLAUDE.md, instead of one long blocking wait.
 *
 * Uses a hand-rolled SSE parser over fetch()'s ReadableStream rather than
 * the native EventSource, because EventSource can't send a POST body (we
 * need to send the question).
 */
export async function streamQuery(
  question: string,
  handlers: {
    onTitle: (payload: TitlePayload) => void;
    onBlocks: (payload: BlocksPayload) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  // Relative, same-origin path -- proxied to the backend by the rewrite in
  // next.config.ts. Never call the backend's absolute http:// URL directly
  // from the browser (mixed-content block on the https:// deployed site).
  const res = await fetch(`/api/${TENANT_SLUG}/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    handlers.onError(`query failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventMatch = rawEvent.match(/^event: (.+)$/m);
      const dataMatch = rawEvent.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const eventType = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      if (eventType === "title") handlers.onTitle(data);
      else if (eventType === "blocks") handlers.onBlocks(data);
      else if (eventType === "error") handlers.onError(data.detail ?? "unknown error");
    }
  }
}
