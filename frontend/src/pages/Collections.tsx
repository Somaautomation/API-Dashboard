import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

interface CollectionItem {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  assertions: any[];
}
interface Collection {
  id: string;
  name: string;
  description: string;
  items: CollectionItem[];
  tags: string[];
}

interface RunItemResult {
  name: string;
  method?: string;
  url?: string;
  status_code?: number;
  duration_ms?: number;
  response_headers?: Record<string, string>;
  response_body?: string;
  response_truncated?: boolean;
  response_size?: number;
  error?: string;
}

interface RunResult {
  id: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  summary?: { items?: RunItemResult[] };
  assertions?: { item_name: string; assertion_type: string; passed: boolean; message: string }[];
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function safeParseJson(text: string, fallback: any) {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function methodColor(m: string) {
  switch (m) {
    case "GET":    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "POST":   return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
    case "PUT":    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "PATCH":  return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
    case "DELETE": return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
    default:       return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function statusCodeColor(code?: number) {
  if (code === undefined) return "bg-slate-200 text-slate-700";
  if (code < 300) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (code < 400) return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
  if (code < 500) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

function prettyBody(body?: string) {
  if (!body) return "";
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch { /* noop */ }
  }
  return body;
}

function RunResults({ result }: { result: RunResult }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const items = result.summary?.items ?? [];
  return (
    <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-md">
      <div className="px-3 py-2 flex items-center gap-2 text-xs border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        <span className={`badge px-1.5 py-0.5 font-bold ${result.status === "passed" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>
          {result.status}
        </span>
        <span className="font-medium">{result.passed}/{result.total} passed</span>
        <span className="text-slate-500">· {result.duration_ms} ms</span>
        <span className="text-slate-400 font-mono ml-auto truncate" title={result.id}>{result.id.slice(0, 8)}</span>
      </div>
      {items.length === 0 && (
        <div className="p-3 text-xs text-slate-500 italic">No per-request data captured.</div>
      )}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <div key={i}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
                onClick={() => setOpenIdx(open ? null : i)}
              >
                <span className="text-slate-400 text-xs w-4">{open ? "▾" : "▸"}</span>
                <span className={`badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method || "?")}`}>
                  {it.method || "?"}
                </span>
                {it.error ? (
                  <span className="badge px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">ERR</span>
                ) : (
                  <span className={`badge px-1.5 py-0.5 text-[10px] font-bold ${statusCodeColor(it.status_code)}`}>{it.status_code}</span>
                )}
                <span className="text-xs font-medium truncate">{it.name}</span>
                <span className="text-[11px] text-slate-500 whitespace-nowrap ml-auto">{it.duration_ms ?? 0} ms</span>
              </button>
              {open && (
                <div className="px-3 pb-3 space-y-2 bg-slate-50/60 dark:bg-slate-900/30">
                  <div className="text-[11px] font-mono text-slate-500 break-all">{it.url}</div>
                  {it.error && (
                    <div className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all">{it.error}</div>
                  )}
                  {it.response_headers && Object.keys(it.response_headers).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-500">Headers ({Object.keys(it.response_headers).length})</summary>
                      <pre className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] overflow-auto max-h-40">
{Object.entries(it.response_headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
                      </pre>
                    </details>
                  )}
                  {it.response_body !== undefined && (
                    <details open className="text-xs">
                      <summary className="cursor-pointer text-slate-500">
                        Body{it.response_size !== undefined && (
                          <span className="text-slate-400"> ({it.response_size} bytes{it.response_truncated ? ", truncated" : ""})</span>
                        )}
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-slate-900 text-slate-100 text-[11px] overflow-auto max-h-72 whitespace-pre-wrap break-all">
{prettyBody(it.response_body) || "(empty)"}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AuthType = "none" | "bearer" | "apikey" | "basic" | "oauth2";

type OAuthGrant = "client_credentials" | "password" | "manual";

interface AuthState {
  type: AuthType;
  token: string;            // bearer / oauth2 access token
  apiKeyName: string;       // apikey header name (e.g. X-API-Key)
  apiKeyValue: string;      // apikey value
  apiKeyIn: "header" | "query";
  basicUser: string;
  basicPass: string;
  // OAuth2
  oauthGrant: OAuthGrant;
  oauthTokenUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthScope: string;
  oauthUsername: string;     // password grant
  oauthPassword: string;     // password grant
  oauthClientAuth: "basic" | "body"; // how to send client creds
  oauthHeaderPrefix: string; // usually "Bearer"
}

const DEFAULT_AUTH: AuthState = {
  type: "none",
  token: "",
  apiKeyName: "X-API-Key",
  apiKeyValue: "",
  apiKeyIn: "header",
  basicUser: "",
  basicPass: "",
  oauthGrant: "client_credentials",
  oauthTokenUrl: "",
  oauthClientId: "",
  oauthClientSecret: "",
  oauthScope: "",
  oauthUsername: "",
  oauthPassword: "",
  oauthClientAuth: "basic",
  oauthHeaderPrefix: "Bearer",
};

const AUTH_HEADER_KEYS = ["authorization", "Authorization"];

function findHeader(obj: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const k of Object.keys(obj)) if (k.toLowerCase() === lower) return obj[k];
  return undefined;
}

function detectAuth(
  headers: Record<string, string>,
  query: Record<string, string>
): { auth: AuthState; strippedHeaders: Record<string, string>; strippedQuery: Record<string, string> } {
  const h = { ...headers };
  const q = { ...query };
  const authHeader = findHeader(h, "Authorization");
  let auth: AuthState = { ...DEFAULT_AUTH };

  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    auth.type = "bearer";
    auth.token = authHeader.replace(/^Bearer\s+/i, "").trim();
    for (const k of AUTH_HEADER_KEYS) delete h[k];
  } else if (authHeader && /^Basic\s+/i.test(authHeader)) {
    try {
      const decoded = atob(authHeader.replace(/^Basic\s+/i, "").trim());
      const [u, ...rest] = decoded.split(":");
      auth.type = "basic";
      auth.basicUser = u || "";
      auth.basicPass = rest.join(":");
    } catch {
      /* leave as raw header */
    }
    for (const k of AUTH_HEADER_KEYS) delete h[k];
  } else {
    // Detect api-key style headers (X-API-Key, x-api-key, apikey, api-key)
    const apiKeyKey = Object.keys(h).find((k) =>
      /^(x-api-key|api-key|apikey)$/i.test(k)
    );
    if (apiKeyKey) {
      auth.type = "apikey";
      auth.apiKeyIn = "header";
      auth.apiKeyName = apiKeyKey;
      auth.apiKeyValue = h[apiKeyKey];
      delete h[apiKeyKey];
    } else {
      const apiKeyQ = Object.keys(q).find((k) =>
        /^(api_?key|apikey)$/i.test(k)
      );
      if (apiKeyQ) {
        auth.type = "apikey";
        auth.apiKeyIn = "query";
        auth.apiKeyName = apiKeyQ;
        auth.apiKeyValue = q[apiKeyQ];
        delete q[apiKeyQ];
      }
    }
  }
  return { auth, strippedHeaders: h, strippedQuery: q };
}

function applyAuth(
  headers: Record<string, string>,
  query: Record<string, string>,
  auth: AuthState
): { headers: Record<string, string>; query: Record<string, string> } {
  const h: Record<string, string> = { ...headers };
  const q: Record<string, string> = { ...query };
  // strip any existing auth artifacts first
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === "authorization") delete h[k];
    if (/^(x-api-key|api-key|apikey)$/i.test(k)) delete h[k];
  }
  for (const k of Object.keys(q)) {
    if (/^(api_?key|apikey)$/i.test(k)) delete q[k];
  }
  if (auth.type === "bearer" && auth.token.trim()) {
    h["Authorization"] = `Bearer ${auth.token.trim()}`;
  } else if (auth.type === "oauth2" && auth.token.trim()) {
    const prefix = (auth.oauthHeaderPrefix || "Bearer").trim();
    h["Authorization"] = `${prefix} ${auth.token.trim()}`;
  } else if (auth.type === "basic" && (auth.basicUser || auth.basicPass)) {
    const enc = btoa(`${auth.basicUser}:${auth.basicPass}`);
    h["Authorization"] = `Basic ${enc}`;
  } else if (auth.type === "apikey" && auth.apiKeyName && auth.apiKeyValue) {
    if (auth.apiKeyIn === "header") h[auth.apiKeyName] = auth.apiKeyValue;
    else q[auth.apiKeyName] = auth.apiKeyValue;
  }
  return { headers: h, query: q };
}

function OAuth2Panel({
  auth,
  setAuth,
  showToken,
  setShowToken,
}: {
  auth: AuthState;
  setAuth: (a: AuthState) => void;
  showToken: boolean;
  setShowToken: (fn: (s: boolean) => boolean) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [fetchInfo, setFetchInfo] = useState<string | null>(null);

  const fetchToken = async () => {
    setFetchErr(null);
    setFetchInfo(null);
    if (auth.oauthGrant === "manual") return;
    if (!auth.oauthTokenUrl) {
      setFetchErr("Token URL is required");
      return;
    }
    setFetching(true);
    try {
      const form = new URLSearchParams();
      form.set("grant_type", auth.oauthGrant);
      if (auth.oauthScope) form.set("scope", auth.oauthScope);
      if (auth.oauthGrant === "password") {
        form.set("username", auth.oauthUsername);
        form.set("password", auth.oauthPassword);
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      };
      if (auth.oauthClientAuth === "basic" && auth.oauthClientId) {
        headers["Authorization"] =
          "Basic " + btoa(`${auth.oauthClientId}:${auth.oauthClientSecret}`);
      } else if (auth.oauthClientAuth === "body" && auth.oauthClientId) {
        form.set("client_id", auth.oauthClientId);
        if (auth.oauthClientSecret) form.set("client_secret", auth.oauthClientSecret);
      }
      const res = await fetch(auth.oauthTokenUrl, {
        method: "POST",
        headers,
        body: form.toString(),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(
          data?.error_description || data?.error || `HTTP ${res.status}: ${text.slice(0, 200)}`
        );
      }
      if (!data.access_token) {
        throw new Error("Response did not contain access_token");
      }
      setAuth({ ...auth, token: data.access_token });
      const expiresIn = data.expires_in ? `, expires in ${data.expires_in}s` : "";
      setFetchInfo(`✓ token received (${data.token_type || "Bearer"}${expiresIn})`);
    } catch (e: any) {
      setFetchErr(e?.message || "Failed to fetch token");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-500 w-20">Grant</label>
        <select
          className="input h-8 text-xs"
          value={auth.oauthGrant}
          onChange={(e) =>
            setAuth({ ...auth, oauthGrant: e.target.value as OAuthGrant })
          }
        >
          <option value="client_credentials">Client Credentials</option>
          <option value="password">Password Credentials</option>
          <option value="manual">Paste access token</option>
        </select>
      </div>

      {auth.oauthGrant !== "manual" && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Token URL</label>
            <input
              className="input text-xs flex-1"
              placeholder="https://idp.example.com/oauth/token"
              value={auth.oauthTokenUrl}
              onChange={(e) => setAuth({ ...auth, oauthTokenUrl: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Client ID</label>
            <input
              className="input text-xs flex-1"
              value={auth.oauthClientId}
              onChange={(e) => setAuth({ ...auth, oauthClientId: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Client Secret</label>
            <input
              className="input font-mono text-xs flex-1"
              type={showToken ? "text" : "password"}
              value={auth.oauthClientSecret}
              onChange={(e) => setAuth({ ...auth, oauthClientSecret: e.target.value })}
            />
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:underline"
              onClick={() => setShowToken((s) => !s)}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Send creds</label>
            <select
              className="input h-8 text-xs"
              value={auth.oauthClientAuth}
              onChange={(e) =>
                setAuth({
                  ...auth,
                  oauthClientAuth: e.target.value as "basic" | "body",
                })
              }
            >
              <option value="basic">Basic Auth header</option>
              <option value="body">In request body</option>
            </select>
          </div>
          {auth.oauthGrant === "password" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 w-20">Username</label>
                <input
                  className="input text-xs flex-1"
                  value={auth.oauthUsername}
                  onChange={(e) => setAuth({ ...auth, oauthUsername: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 w-20">Password</label>
                <input
                  className="input font-mono text-xs flex-1"
                  type={showToken ? "text" : "password"}
                  value={auth.oauthPassword}
                  onChange={(e) => setAuth({ ...auth, oauthPassword: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Scope</label>
            <input
              className="input text-xs flex-1"
              placeholder="read:users write:users"
              value={auth.oauthScope}
              onChange={(e) => setAuth({ ...auth, oauthScope: e.target.value })}
            />
          </div>
          <div>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={fetching}
              onClick={fetchToken}
            >
              {fetching ? "Fetching…" : "Get access token"}
            </button>
            {fetchInfo && (
              <span className="ml-2 text-[11px] text-emerald-600">{fetchInfo}</span>
            )}
            {fetchErr && (
              <span className="ml-2 text-[11px] text-rose-600">{fetchErr}</span>
            )}
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-500 w-20">Access token</label>
        <input
          className="input font-mono text-xs flex-1"
          type={showToken ? "text" : "password"}
          placeholder="paste or fetch above"
          value={auth.token}
          onChange={(e) => setAuth({ ...auth, token: e.target.value })}
        />
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:underline"
          onClick={() => setShowToken((s) => !s)}
        >
          {showToken ? "Hide" : "Show"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-slate-500 w-20">Header prefix</label>
        <input
          className="input text-xs w-32"
          value={auth.oauthHeaderPrefix}
          onChange={(e) => setAuth({ ...auth, oauthHeaderPrefix: e.target.value })}
        />
        <span className="text-[10px] text-slate-400">
          sends <code>Authorization: {auth.oauthHeaderPrefix || "Bearer"} &lt;token&gt;</code>
        </span>
      </div>
    </div>
  );
}

function RequestForm({
  collectionId,
  existing,
  onDone,
  onCancel,
}: {
  collectionId: string;
  existing?: CollectionItem;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const isEdit = !!existing;
  const initialAssertion =
    existing?.assertions?.find((a) => a?.type === "status_code")?.expected ?? 200;

  const detected = detectAuth(existing?.headers ?? {}, existing?.query ?? {});

  const [name, setName] = useState(existing?.name ?? "");
  const [method, setMethod] = useState(existing?.method ?? "GET");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [auth, setAuth] = useState<AuthState>(
    existing ? detected.auth : { ...DEFAULT_AUTH }
  );
  const [headersText, setHeadersText] = useState(
    JSON.stringify(
      existing
        ? Object.keys(detected.strippedHeaders).length
          ? detected.strippedHeaders
          : { Accept: "application/json" }
        : { Accept: "application/json" },
      null,
      2
    )
  );
  const [queryText, setQueryText] = useState(
    JSON.stringify(existing ? detected.strippedQuery : {}, null, 2)
  );
  const [bodyText, setBodyText] = useState(
    existing?.body ? JSON.stringify(existing.body, null, 2) : ""
  );
  const [expectedStatus, setExpectedStatus] = useState<number>(Number(initialAssertion));
  const [showToken, setShowToken] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      setErr(null);
      const baseHeaders = safeParseJson(headersText, {}) as Record<string, string>;
      const baseQuery = safeParseJson(queryText, {}) as Record<string, string>;
      const merged = applyAuth(baseHeaders, baseQuery, auth);
      const payload = {
        name: name || `${method} ${url}`,
        method,
        url,
        headers: merged.headers,
        query: merged.query,
        body: bodyText.trim() ? safeParseJson(bodyText, null) : null,
        assertions: [{ type: "status_code", expected: Number(expectedStatus) }],
      };
      if (isEdit) {
        return (
          await api.put(`/collections/${collectionId}/items/${existing!.id}`, payload)
        ).data;
      }
      return (await api.post(`/collections/${collectionId}/items`, payload)).data;
    },
    onSuccess: () => {
      if (!isEdit) {
        setName("");
        setUrl("");
        setBodyText("");
      }
      onDone();
    },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? e.message ?? "Failed"),
  });

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 mt-2 space-y-2 bg-slate-50/60 dark:bg-slate-800/30">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {isEdit ? "Edit request" : "Add request"}
        </div>
        {onCancel && (
          <button className="text-xs text-slate-500 hover:underline ml-auto" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-2">
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          className="input"
          placeholder="https://api.qa-zpecloud.com/device"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <input
        className="input"
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Authorization */}
      <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2 space-y-2 bg-white/60 dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 w-20">Auth</label>
          <select
            className="input h-8 text-xs"
            value={auth.type}
            onChange={(e) => setAuth({ ...auth, type: e.target.value as AuthType })}
          >
            <option value="none">No Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="apikey">API Key</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth2">OAuth 2.0</option>
          </select>
          <span className="text-[10px] text-slate-400 ml-auto">
            Saved into request headers on save
          </span>
        </div>

        {auth.type === "bearer" && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Token</label>
            <input
              className="input font-mono text-xs flex-1"
              type={showToken ? "text" : "password"}
              placeholder="zpe_cloud_EaJl4d..."
              value={auth.token}
              onChange={(e) => setAuth({ ...auth, token: e.target.value })}
            />
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:underline"
              onClick={() => setShowToken((s) => !s)}
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
        )}

        {auth.type === "apikey" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 w-20">Key</label>
              <input
                className="input text-xs flex-1"
                placeholder="X-API-Key"
                value={auth.apiKeyName}
                onChange={(e) => setAuth({ ...auth, apiKeyName: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 w-20">Value</label>
              <input
                className="input font-mono text-xs flex-1"
                type={showToken ? "text" : "password"}
                placeholder="api key value"
                value={auth.apiKeyValue}
                onChange={(e) => setAuth({ ...auth, apiKeyValue: e.target.value })}
              />
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:underline"
                onClick={() => setShowToken((s) => !s)}
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 w-20">Add to</label>
              <select
                className="input h-8 text-xs"
                value={auth.apiKeyIn}
                onChange={(e) =>
                  setAuth({ ...auth, apiKeyIn: e.target.value as "header" | "query" })
                }
              >
                <option value="header">Header</option>
                <option value="query">Query Params</option>
              </select>
            </div>
          </>
        )}

        {auth.type === "basic" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 w-20">Username</label>
              <input
                className="input text-xs flex-1"
                value={auth.basicUser}
                onChange={(e) => setAuth({ ...auth, basicUser: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 w-20">Password</label>
              <input
                className="input font-mono text-xs flex-1"
                type={showToken ? "text" : "password"}
                value={auth.basicPass}
                onChange={(e) => setAuth({ ...auth, basicPass: e.target.value })}
              />
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:underline"
                onClick={() => setShowToken((s) => !s)}
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </>
        )}

        {auth.type === "oauth2" && (
          <OAuth2Panel
            auth={auth}
            setAuth={setAuth}
            showToken={showToken}
            setShowToken={setShowToken}
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-slate-500">Headers (JSON)</label>
          <textarea
            className="input font-mono text-xs h-20"
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500">Query (JSON)</label>
          <textarea
            className="input font-mono text-xs h-20"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-500">Body (JSON, leave empty for none)</label>
        <textarea
          className="input font-mono text-xs h-24"
          placeholder='{"key":"value"}'
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Expect status</label>
        <input
          type="number"
          className="input w-24"
          value={expectedStatus}
          onChange={(e) => setExpectedStatus(Number(e.target.value))}
        />
        <button
          className="btn-primary ml-auto"
          disabled={!url || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (isEdit ? "Saving…" : "Adding…") : (isEdit ? "Save" : "Add request")}
        </button>
      </div>

      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}

function AddRequestForm({ collectionId, onAdded }: { collectionId: string; onAdded: () => void }) {
  return <RequestForm collectionId={collectionId} onDone={onAdded} />;
}

function ItemsList({
  collection,
  onChanged,
  onItemResult,
  environmentId,
}: {
  collection: Collection;
  onChanged: () => void;
  onItemResult: (result: RunResult) => void;
  environmentId?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningItemId, setRunningItemId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: async (itemId: string) =>
      api.delete(`/collections/${collection.id}/items/${itemId}`),
    onSuccess: () => {
      setEditingId(null);
      onChanged();
    },
  });

  const runItem = useMutation({
    mutationFn: async (itemId: string) => {
      const item = collection.items.find((i) => i.id === itemId);
      if (item && /\{\{[^}]+\}\}/.test(item.url) && !environmentId) {
        if (
          !confirm(
            `This URL contains template variables like {{baseUrl}} but no environment is selected.\n\n` +
              `Pick an environment in the "Environment for runs" dropdown at the top.\n\n` +
              `Run anyway (will likely fail)?`
          )
        ) {
          throw new Error("Cancelled: no environment selected for templated URL");
        }
      }
      setRunningItemId(itemId);
      try {
        const body: any = {
          collection_id: collection.id,
          item_id: itemId,
          variables: {},
        };
        if (environmentId) body.environment_id = environmentId;
        return (await api.post(`/runs/item`, body)).data as RunResult;
      } finally {
        setRunningItemId(null);
      }
    },
    onSuccess: (r) => onItemResult(r),
    onError: (e: any) =>
      alert(`Run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
  });

  if (collection.items.length === 0) {
    return <div className="text-xs text-slate-500 italic">No requests yet — add one below.</div>;
  }

  const clearSession = async () => {
    try {
      await api.post(`/collections/${collection.id}/session/clear`);
      alert("Session cookies cleared. Next run starts fresh.");
    } catch (e: any) {
      alert(`Failed: ${e?.response?.data?.detail ?? e.message}`);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end">
        <button
          className="text-[11px] text-slate-500 hover:text-rose-600 hover:underline"
          onClick={clearSession}
          title="Clear cached login cookies for this collection"
        >
          Reset session
        </button>
      </div>
      <ul className="text-xs divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
      {collection.items.map((it) => {
        const isEditing = editingId === it.id;
        return (
          <li key={it.id} className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method)}`}>
                {it.method}
              </span>
              <span className="font-medium truncate" title={it.name}>{it.name}</span>
              <span className="font-mono text-slate-500 truncate flex-1" title={it.url}>{it.url}</span>
              <button
                className="text-sky-600 hover:underline text-[11px]"
                disabled={runningItemId === it.id}
                onClick={() => runItem.mutate(it.id)}
                title="Run only this request"
              >
                {runningItemId === it.id ? "Running…" : "Run"}
              </button>
              <button
                className="text-slate-600 dark:text-slate-300 hover:underline text-[11px]"
                onClick={() => setEditingId(isEditing ? null : it.id)}
                title="Edit this request"
              >
                {isEditing ? "Close" : "Edit"}
              </button>
              <button
                className="text-rose-600 hover:underline text-[11px]"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm(`Delete request "${it.name}"?`)) del.mutate(it.id);
                }}
                title="Remove this request"
              >
                ✕
              </button>
            </div>
            {isEditing && (
              <RequestForm
                collectionId={collection.id}
                existing={it}
                onCancel={() => setEditingId(null)}
                onDone={() => {
                  setEditingId(null);
                  onChanged();
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
    </div>
  );
}

export default function Collections() {
  const qc = useQueryClient();
  const [specId, setSpecId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [envId, setEnvId] = useState<string>(
    () => localStorage.getItem("collections.envId") || ""
  );

  useEffect(() => {
    localStorage.setItem("collections.envId", envId);
  }, [envId]);

  const { data: cols } = useQuery({
    queryKey: ["cols"],
    queryFn: async () => (await api.get<Collection[]>("/collections")).data,
  });
  const { data: specs } = useQuery({
    queryKey: ["specs"],
    queryFn: async () => (await api.get("/swagger")).data,
  });
  const { data: envs } = useQuery({
    queryKey: ["envs"],
    queryFn: async () =>
      (await api.get<{ id: string; name: string; base_url: string }[]>("/environments")).data,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const generate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/collections/from-spec/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/collections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
  });
  const prependLogin = useMutation({
    mutationFn: async (vars: { id: string; email: string; password: string; login_path: string }) =>
      (
        await api.post(`/collections/${vars.id}/prepend-login`, {
          email: vars.email,
          password: vars.password,
          login_path: vars.login_path,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
  });
  function onPrependLogin(id: string) {
    const email = prompt("Login email", "somashekar.rangaswamy@zpesystems.com");
    if (!email) return;
    const password = prompt("Password");
    if (!password) return;
    const login_path = prompt("Login path (relative to base URL)", "/user/auth") || "/user/auth";
    prependLogin.mutate({ id, email, password, login_path });
  }
  const run = useMutation({
    mutationFn: async (id: string) => {
      const c = cols?.find((x) => x.id === id);
      if (c && !envId && c.items.some((it) => /\{\{[^}]+\}\}/.test(it.url))) {
        if (
          !confirm(
            `Some requests use {{baseUrl}} or other template variables but no environment is selected.\n\n` +
              `Pick an environment in the "Environment for runs" dropdown.\n\n` +
              `Run anyway (those requests will likely fail)?`
          )
        ) {
          throw new Error("Cancelled: no environment selected for templated URLs");
        }
      }
      setRunningId(id);
      try {
        const body: any = { collection_id: id, variables: {} };
        if (envId) body.environment_id = envId;
        const r = (await api.post(`/runs`, body)).data as RunResult;
        return { id, result: r };
      } finally {
        setRunningId(null);
      }
    },
    onSuccess: ({ id, result }) => {
      setResults((prev) => ({ ...prev, [id]: result }));
      setOpenId(id);
    },
    onError: (e: any) =>
      alert(`Run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
  });

  const importPostman = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (
        await api.post("/collections/import/postman", form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
    onError: (e: any) =>
      alert(`Import failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
  });

  function onPickPostman(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) importPostman.mutate(f);
    e.target.value = "";
  }

  const sampleLogin = useMutation({
    mutationFn: async () =>
      (
        await api.post("/collections", {
          name: "Sample: ZPECloud Login",
          description: "POST /user/auth against api.qa-zpecloud.com",
          tags: ["sample", "auth"],
          items: [
            {
              name: "Login",
              method: "POST",
              url: "https://api.qa-zpecloud.com/user/auth",
              headers: { "Content-Type": "application/json" },
              query: {},
              body: {
                email: "somashekar.rangaswamy@zpesystems.com",
                password: "Varchas@24",
              },
              assertions: [{ type: "status_code", expected: 200 }],
            },
          ],
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
  });

  async function downloadExport(id: string, name: string, fmt: string) {
    try {
      const res = await api.get(`/collections/${id}/export`, {
        params: { fmt },
        responseType: "blob",
      });
      const cd = res.headers["content-disposition"] as string | undefined;
      let filename = `${name || "collection"}.${fmt}`;
      const m = cd?.match(/filename="?([^"]+)"?/i);
      if (m) filename = m[1];
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Collections</h1>

      <div className="card p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-slate-500">Generate from spec</label>
          <select className="input mt-1" value={specId} onChange={(e) => setSpecId(e.target.value)}>
            <option value="">— pick a spec —</option>
            {specs?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} ({s.version})</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="text-xs text-slate-500">
            Environment for runs
            {envId && envs?.find((e) => e.id === envId)?.base_url && (
              <span className="ml-1 font-mono text-[10px] text-emerald-600">
                {`{{baseUrl}}`} → {envs.find((e) => e.id === envId)!.base_url}
              </span>
            )}
          </label>
          <select className="input mt-1" value={envId} onChange={(e) => setEnvId(e.target.value)}>
            <option value="">— none (no variable substitution) —</option>
            {envs?.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" disabled={!specId || generate.isPending}
                onClick={() => generate.mutate(specId)}>Generate</button>
        <label className="btn-ghost border border-slate-200 dark:border-slate-700 cursor-pointer">
          {importPostman.isPending ? "Importing…" : "Import Postman"}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onPickPostman}
            disabled={importPostman.isPending}
          />
        </label>
        <button
          className="btn-ghost border border-slate-200 dark:border-slate-700"
          disabled={sampleLogin.isPending}
          onClick={() => sampleLogin.mutate()}
          title="Create a sample collection with a POST login to api.qa-zpecloud.com"
        >
          + ZPECloud login sample
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {cols?.map((c) => {
          const isOpen = openId === c.id;
          return (
            <div key={c.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.name}</div>
                <span className="badge bg-slate-100 dark:bg-slate-800">{c.items.length} items</span>
              </div>
              <p className="text-sm text-slate-500">{c.description || "—"}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button className="btn-primary" disabled={runningId === c.id} onClick={() => run.mutate(c.id)}>
                  {runningId === c.id ? "Running…" : "Run"}
                </button>
                <button
                  className="btn-ghost border border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  disabled={prependLogin.isPending}
                  onClick={() => onPrependLogin(c.id)}
                  title="Insert a POST /user/auth login at position 0; subsequent items inherit its session cookie"
                >
                  {prependLogin.isPending ? "Adding…" : "+ Login step"}
                </button>
                <button
                  className="btn-ghost border border-slate-200 dark:border-slate-700"
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                >
                  {isOpen ? "Hide requests" : `Manage requests (${c.items.length})`}
                </button>
                {["postman", "curl", "robot", "playwright", "k6"].map((f) => (
                  <button
                    key={f}
                    className="btn-ghost border border-slate-200 dark:border-slate-700"
                    onClick={() => downloadExport(c.id, c.name, f)}
                    title={`Download as ${f}`}
                  >
                    {f}
                  </button>
                ))}
                <button className="btn-ghost text-red-600 ml-auto" onClick={() => del.mutate(c.id)}>Delete</button>
              </div>

              {isOpen && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] text-slate-500">
                    {envId && envs?.find((e) => e.id === envId) ? (
                      <>
                        Using env <b>{envs.find((e) => e.id === envId)!.name}</b>
                        {envs.find((e) => e.id === envId)!.base_url && (
                          <>
                            {" "}
                            — <code>{`{{baseUrl}}`}</code> ={" "}
                            <span className="font-mono text-emerald-600">
                              {envs.find((e) => e.id === envId)!.base_url}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-600">
                        No environment selected — <code>{`{{baseUrl}}`}</code> will not be substituted.
                      </span>
                    )}
                  </div>
                  <ItemsList
                    collection={c}
                    onChanged={() => qc.invalidateQueries({ queryKey: ["cols"] })}
                    onItemResult={(r) => setResults((prev) => ({ ...prev, [c.id]: r }))}
                    environmentId={envId || undefined}
                  />
                  <AddRequestForm
                    collectionId={c.id}
                    onAdded={() => qc.invalidateQueries({ queryKey: ["cols"] })}
                  />
                </div>
              )}

              {results[c.id] && <RunResults result={results[c.id]} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
