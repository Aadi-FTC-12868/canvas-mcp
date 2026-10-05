/** Read-only Canvas transport. Credentials never follow links off the configured origin. */
export type Query = Record<string, string | string[]>;
export class CanvasError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message); this.name = "CanvasError";
  }
}
export interface CanvasClientOptions {
  baseUrl?: string; token?: string; fetch?: typeof fetch; maxPages?: number;
  maxItems?: number; maxBytes?: number; timeoutMs?: number; allowHttpLocalhost?: boolean;
  sleep?: (ms: number) => Promise<void>;
}
export class CanvasClient {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  private readonly options: Required<Pick<CanvasClientOptions, "maxPages" | "maxItems" | "maxBytes" | "timeoutMs">>;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(options: CanvasClientOptions = {}) {
    const base = options.baseUrl ?? process.env.CANVAS_BASE_URL;
    this.token = options.token ?? process.env.CANVAS_API_TOKEN ?? "";
    if (!base || !this.token) throw new CanvasError("configuration_required", "Set CANVAS_BASE_URL and CANVAS_API_TOKEN in the server environment. Never pass credentials through a tool.");
    let url: URL;
    try { url = new URL(base); } catch { throw new CanvasError("invalid_origin", "Canvas base URL must be an HTTPS origin."); }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(options.allowHttpLocalhost && loopback && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new CanvasError("invalid_origin", "Use a Canvas HTTPS origin without a path, credentials, query, or fragment.");
    }
    this.baseUrl = url.origin;
    this.fetcher = options.fetch ?? fetch;
    this.options = {maxPages: options.maxPages ?? 10, maxItems: options.maxItems ?? 1000, maxBytes: options.maxBytes ?? 4 * 1024 * 1024, timeoutMs: options.timeoutMs ?? 15000};
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }
  private endpoint(path: string, params: Query): URL {
    if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path) || /%(?:2e|2f|5c)/i.test(path)) {
      throw new CanvasError("invalid_endpoint", "Expected a Canvas API path without traversal or embedded query parameters.");
    }
    const url = new URL("/api/v1" + path, this.baseUrl);
    for (const [key, values] of Object.entries(params)) {
      if (/token|secret|password|authorization/i.test(key)) throw new CanvasError("invalid_query", "Credentials cannot be provided as query parameters.");
      for (const value of Array.isArray(values) ? values : [values]) url.searchParams.append(key, value);
    }
    return url;
  }
  private async read(url: URL): Promise<{data: unknown; next: string | null}> {
    if (url.origin !== this.baseUrl || !url.pathname.startsWith("/api/v1/") || url.username || url.password) throw new CanvasError("unsafe_url", "Refused an untrusted Canvas URL.");
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(url, {headers: {Authorization: "Bearer " + this.token, Accept: "application/json+canvas-string-ids"}, redirect: "manual", signal: AbortSignal.timeout(this.options.timeoutMs)});
      } catch { throw new CanvasError("network_error", "Canvas request failed or timed out. Retry the read later."); }
      if (response.status === 429 && attempt < 2) {
        const retry = response.headers.get("retry-after");
        const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 1000 * 2 ** attempt;
        await response.body?.cancel();
        if (!Number.isFinite(delay) || delay > 10000) throw new CanvasError("rate_limited", "Canvas requested a longer retry delay. Retry later.", 429);
        await this.sleep(Math.max(0, delay)); continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        const codes: Record<number, [string, string]> = {
          401: ["authentication_required", "Canvas authentication expired or was rejected. Reconnect your account."],
          403: ["permission_denied", "Canvas denied access. Check enrollment, scopes, and school policy."],
          404: ["not_found", "Canvas resource was not found or is not visible to this user."],
          429: ["rate_limited", "Canvas rate limit reached. Retry later."]
        };
        const [code, message] = codes[response.status] ?? ["upstream_error", "Canvas returned HTTP " + response.status + ". Redirects are not followed."];
        throw new CanvasError(code, message, response.status);
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        if (reader) while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > this.options.maxBytes) { await reader.cancel(); throw new CanvasError("response_limit", "Canvas response exceeded the byte limit; narrow the request."); }
          chunks.push(value);
        }
      } catch (err) { if (err instanceof CanvasError) throw err; throw new CanvasError("network_error", "Canvas response could not be read completely."); }
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw new CanvasError("invalid_response", "Canvas did not return valid JSON."); }
      // Link parameters can precede rel, and rel may contain multiple relation types.
      // Parse quoted values together so a title containing '; rel=next' is not a relation.
      let next: string | null = null;
      for (const link of (response.headers.get("link") ?? "").matchAll(/<([^>]+)>([^<]*)/g)) {
        for (const parameter of link[2].matchAll(/;\s*([^=\s;,]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^;,\s]+))/g)) {
          const value = parameter[2] ?? parameter[3] ?? parameter[4];
          if (parameter[1].toLowerCase() === "rel" && value.toLowerCase().split(/\s+/).includes("next")) {
            if (next) throw new CanvasError("invalid_pagination", "Canvas returned multiple next-page links; no complete list was returned.");
            next = link[1];
          }
        }
      }
      return {data, next};
    }
    throw new CanvasError("rate_limited", "Canvas rate limit reached.", 429);
  }
  async getOne<T>(path: string, params: Query = {}): Promise<T> {
    return (await this.read(this.endpoint(path, params))).data as T;
  }
  async getAll<T>(path: string, params: Query = {}): Promise<T[]> {
    let url = this.endpoint(path, {per_page: "100", ...params});
    const initialPath = url.pathname; const seen = new Set<string>(); const results: T[] = [];
    for (let page = 0; page < this.options.maxPages; page++) {
      if (seen.has(url.href)) throw new CanvasError("pagination_cycle", "Canvas repeated a pagination URL; results are incomplete.");
      seen.add(url.href);
      const response = await this.read(url);
      if (!Array.isArray(response.data)) throw new CanvasError("invalid_response", "Expected a list from this Canvas endpoint.");
      results.push(...response.data as T[]);
      if (results.length > this.options.maxItems) throw new CanvasError("pagination_limit", "Canvas results exceeded the item limit; narrow the request. No complete list was returned.");
      if (!response.next) return results;
      const next = new URL(response.next, url);
      if (next.origin !== this.baseUrl || next.pathname !== initialPath || next.username || next.password || next.hash || [...next.searchParams.keys()].some(key => /token|secret|password|authorization/i.test(key))) throw new CanvasError("unsafe_pagination", "Canvas supplied an unsafe pagination link; it was not followed.");
      url = next;
    }
    throw new CanvasError("pagination_limit", "Canvas results exceeded the page limit. No complete list was returned.");
  }
}
