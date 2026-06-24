import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Play,
  Trash2,
  Upload,
  Link as LinkIcon,
  ExternalLink,
  KeyRound,
  LogIn,
  LogOut,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";
import { useZpeAuth } from "@/store/zpeAuth";
import { AiTestGeneratorModal } from "@/components/AiTestGeneratorModal";

interface SpecSummary {
  id: string;
  name: string;
  version: string;
  openapi_version: string;
  endpoint_count: number;
  created_at: string;
}

interface ParamDef {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: { type?: string; enum?: string[]; default?: any; example?: any };
  example?: any;
}

interface EndpointOut {
  id: string;
  method: string;
  path: string;
  operation_id: string | null;
  summary: string;
  tags: string[];
  parameters: ParamDef[];
  request_schema: any | null;
  responses: Record<string, any>;
}

interface SpecDetail extends SpecSummary {
  description: string;
  servers: string[];
  endpoints: EndpointOut[];
}

interface EnvOut {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  variables: Record<string, string>;
}

interface TryResponse {
  status: number;
  elapsed_ms: number;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  body: string;
  content_type: string;
  error: string | null;
}

type OAuthGrant = "client_credentials" | "password" | "manual";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500 text-white",
  POST: "bg-amber-500 text-white",
  PUT: "bg-blue-500 text-white",
  PATCH: "bg-violet-500 text-white",
  DELETE: "bg-rose-500 text-white",
  HEAD: "bg-slate-500 text-white",
  OPTIONS: "bg-slate-500 text-white",
};

// --- JSON Schema -> example value (best effort, handles $ref by ignoring) ----
function exampleFromSchema(schema: any, depth = 0): any {
  if (!schema || depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  const t = schema.type;
  if (t === "object" || schema.properties) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema.properties || {})) {
      out[k] = exampleFromSchema(v as any, depth + 1);
    }
    return out;
  }
  if (t === "array") return [exampleFromSchema(schema.items, depth + 1)];
  if (t === "string") {
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "email") return "user@example.com";
    if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
    return "string";
  }
  if (t === "integer" || t === "number") return 0;
  if (t === "boolean") return true;
  return null;
}

function statusTone(code: number): string {
  if (code === 0) return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  if (code < 300) return "bg-emerald-500 text-white";
  if (code < 400) return "bg-sky-500 text-white";
  if (code < 500) return "bg-amber-500 text-white";
  return "bg-rose-600 text-white";
}

function prettify(body: string, ctype: string): string {
  if (ctype.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      /* fallthrough */
    }
  }
  return body;
}

function schemaKind(schema: any): string {
  if (!schema || typeof schema !== "object") return "unknown";
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  if (schema.items) return "array";
  return "schema";
}

function SchemaSection({ schema }: { schema: any }) {
  if (!schema) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900/60">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Request schema
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Rendered from the passed JSON Schema object.
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {schemaKind(schema)}
        </span>
      </div>
      <div className="p-3">
        <SchemaNode schema={schema} name="body" depth={0} />
      </div>
    </div>
  );
}

function SchemaNode({
  schema,
  name,
  depth,
}: {
  schema: any;
  name?: string;
  depth: number;
}) {
  if (!schema || typeof schema !== "object") return null;

  const type = schemaKind(schema);
  const required = Array.isArray(schema.required) ? new Set(schema.required) : new Set<string>();
  const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : null;
  const title = name ? name : schema.title || "schema";
  const hasChildren = Boolean(properties || schema.items);
  const indentClass = depth === 0 ? "" : "ml-4 pl-4 border-l border-slate-200 dark:border-slate-700";

  return (
    <div className={`space-y-3 ${indentClass}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {title}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">type: {type}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {schema.format && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              format: {schema.format}
            </span>
          )}
          {schema.nullable && (
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              nullable
            </span>
          )}
        </div>
      </div>

      {(schema.description || schema.example !== undefined || schema.default !== undefined) && (
        <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-300">
          {schema.description && <p>{schema.description}</p>}
          {schema.example !== undefined && (
            <div className="font-mono text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded px-2 py-1 overflow-auto">
              example: {JSON.stringify(schema.example, null, 2)}
            </div>
          )}
          {schema.default !== undefined && (
            <div className="font-mono text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded px-2 py-1 overflow-auto">
              default: {JSON.stringify(schema.default, null, 2)}
            </div>
          )}
        </div>
      )}

      {type === "object" && properties && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Properties
          </div>
          <div className="space-y-2">
            {Object.entries(properties).map(([propName, propSchema]) => (
              <div
                key={propName}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3"
              >
                <SchemaNode
                  schema={propSchema}
                  name={propName}
                  depth={depth + 1}
                />
                {required.has(propName) && (
                  <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    required
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {type === "array" && schema.items && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Items
          </div>
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3">
            <SchemaNode schema={schema.items} name="item" depth={depth + 1} />
          </div>
        </div>
      )}

      {!hasChildren && schema.enum?.length && (
        <div className="text-[11px] text-slate-500 font-mono">
          enum: {schema.enum.join(", ")}
        </div>
      )}
    </div>
  );
}

// --- Endpoint accordion item -----------------------------------------------
function EndpointRow({ ep, servers }: { ep: EndpointOut; servers: string[] }) {
  const [open, setOpen] = useState(false);
  const { selectedId } = useActiveEnv();
  const { data: envs } = useQuery({
    queryKey: ["envs-for-try"],
    queryFn: async () => (await api.get<EnvOut[]>("/environments")).data,
    staleTime: 60_000,
  });

  const activeEnv = useMemo(
    () => envs?.find((e) => e.id === selectedId) ?? null,
    [envs, selectedId]
  );

  const serverOptions = useMemo(() => {
    const list: string[] = [];
    if (activeEnv?.base_url) list.push(activeEnv.base_url);
    for (const s of servers) if (!list.includes(s)) list.push(s);
    if (!list.length) list.push("https://api.example.com");
    return list;
  }, [activeEnv, servers]);

  const [serverUrl, setServerUrl] = useState(serverOptions[0]);
  useEffect(() => {
    setServerUrl(serverOptions[0]);
  }, [serverOptions]);

  const pathParams = ep.parameters.filter((p) => p.in === "path");
  const queryParams = ep.parameters.filter((p) => p.in === "query");
  const headerParams = ep.parameters.filter((p) => p.in === "header");

  // state for inputs
  const [pathVals, setPathVals] = useState<Record<string, string>>({});
  const [queryVals, setQueryVals] = useState<Record<string, string>>({});
  const [headerVals, setHeaderVals] = useState<Record<string, string>>({});
  const [extraHeaders, setExtraHeaders] = useState<{ k: string; v: string }[]>([]);
  const storedToken = useZpeAuth((s) => s.token);
  const setStoredToken = useZpeAuth((s) => s.setToken);
  const cookieHeader = useZpeAuth((s) => s.cookieHeader());
  const xsrfToken = useZpeAuth((s) => s.cookies["XSRF-TOKEN"] || "");
  const [bearer, setBearer] = useState(storedToken);
  const [cookieVal, setCookieVal] = useState(cookieHeader);
  useEffect(() => {
    // Pick up token if it changes elsewhere (e.g. Quick Login) while this row is closed.
    if (storedToken && !bearer) setBearer(storedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedToken]);
  useEffect(() => {
    if (cookieHeader && !cookieVal) setCookieVal(cookieHeader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieHeader]);
  const [bodyText, setBodyText] = useState<string>(() =>
    ep.request_schema ? JSON.stringify(exampleFromSchema(ep.request_schema), null, 2) : ""
  );
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [resp, setResp] = useState<TryResponse | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const tryMut = useMutation({
    mutationFn: async (payload: any) =>
      (await api.post<TryResponse>("/swagger/try", payload)).data,
    onSuccess: (data) => setResp(data),
    onError: (e: any) =>
      setResp({
        status: 0,
        elapsed_ms: 0,
        headers: {},
        cookies: {},
        body: e?.response?.data?.error?.message ?? String(e),
        content_type: "",
        error: "request failed",
      }),
  });

  // build resolved URL
  const resolvedPath = useMemo(() => {
    let p = ep.path;
    for (const pp of pathParams) {
      const val = pathVals[pp.name] ?? `{${pp.name}}`;
      p = p.replace(`{${pp.name}}`, encodeURIComponent(val));
    }
    return p;
  }, [ep.path, pathParams, pathVals]);

  const fullUrl = (serverUrl || "").replace(/\/$/, "") + resolvedPath;

  function buildHeaders(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const h of headerParams) {
      const v = headerVals[h.name];
      if (v) out[h.name] = v;
    }
    for (const { k, v } of extraHeaders) if (k && v) out[k] = v;
    if (bearer.trim()) out["Authorization"] = `Bearer ${bearer.trim()}`;
    if (cookieVal.trim()) out["Cookie"] = cookieVal.trim();
    if (xsrfToken && !out["X-Xsrf-Token"]) out["X-Xsrf-Token"] = xsrfToken;
    return out;
  }

  function execute() {
    setBodyError(null);
    let parsedBody: any = null;
    let body_kind = "none";
    if (bodyText.trim() && !["GET", "HEAD"].includes(ep.method.toUpperCase())) {
      try {
        parsedBody = JSON.parse(bodyText);
        body_kind = "json";
      } catch (e) {
        setBodyError("Body is not valid JSON");
        return;
      }
    }
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(queryVals)) if (v) q[k] = v;
    tryMut.mutate({
      method: ep.method,
      url: fullUrl,
      headers: buildHeaders(),
      query: q,
      body: parsedBody,
      body_kind,
    });
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono font-bold w-16 text-center ${
            METHOD_COLORS[ep.method] ?? "bg-slate-300 text-slate-700"
          }`}
        >
          {ep.method}
        </span>
        <code className="text-sm font-mono break-all flex-1">{ep.path}</code>
        {ep.summary && (
          <span className="hidden md:block text-xs text-slate-500 truncate max-w-md">
            {ep.summary}
          </span>
        )}
      </button>

      {open && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 space-y-4">
          {ep.summary && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{ep.summary}</p>
          )}

          {/* Server URL */}
          <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Server URL {activeEnv && <span className="text-emerald-600">(env: {activeEnv.name})</span>}
              </label>
              <select
                className="input mt-1"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              >
                {serverOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs">
              <div className="font-semibold text-slate-500 uppercase tracking-wide">Full URL</div>
              <div className="mt-1 font-mono text-[11px] break-all bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                {fullUrl}
              </div>
            </div>
          </div>

          {/* Path params */}
          {pathParams.length > 0 && (
            <ParamSection
              title="Path parameters"
              params={pathParams}
              values={pathVals}
              onChange={setPathVals}
            />
          )}

          {/* Query params */}
          {queryParams.length > 0 && (
            <ParamSection
              title="Query parameters"
              params={queryParams}
              values={queryVals}
              onChange={setQueryVals}
            />
          )}

          {ep.request_schema && <SchemaSection schema={ep.request_schema} />}

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Headers
              </div>
              <button
                type="button"
                className="text-xs text-indigo-600 hover:underline"
                onClick={() => setExtraHeaders((h) => [...h, { k: "", v: "" }])}
              >
                + Add header
              </button>
            </div>
            <div className="space-y-2 mt-2">
              {headerParams.map((h) => (
                <div key={h.name} className="grid grid-cols-[200px_1fr] gap-2">
                  <input
                    className="input"
                    value={h.name}
                    readOnly
                    title={h.required ? "Required" : "Optional"}
                  />
                  <input
                    className="input"
                    placeholder={h.description || h.schema?.type || "value"}
                    value={headerVals[h.name] ?? ""}
                    onChange={(e) => setHeaderVals((v) => ({ ...v, [h.name]: e.target.value }))}
                  />
                </div>
              ))}
              {extraHeaders.map((row, i) => (
                <div key={i} className="grid grid-cols-[200px_1fr_auto] gap-2">
                  <input
                    className="input"
                    placeholder="Header-Name"
                    value={row.k}
                    onChange={(e) =>
                      setExtraHeaders((arr) =>
                        arr.map((r, j) => (j === i ? { ...r, k: e.target.value } : r))
                      )
                    }
                  />
                  <input
                    className="input"
                    placeholder="value"
                    value={row.v}
                    onChange={(e) =>
                      setExtraHeaders((arr) =>
                        arr.map((r, j) => (j === i ? { ...r, v: e.target.value } : r))
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-ghost text-rose-600"
                    onClick={() => setExtraHeaders((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-[200px_1fr] gap-2">
                <input className="input" value="Authorization (Bearer)" readOnly />
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="paste access token (without 'Bearer ')"
                    value={bearer}
                    onChange={(e) => {
                      setBearer(e.target.value);
                      setStoredToken(e.target.value);
                    }}
                  />
                  {storedToken && bearer !== storedToken && (
                    <button
                      type="button"
                      className="btn-ghost text-xs whitespace-nowrap"
                      onClick={() => setBearer(storedToken)}
                      title="Use the token saved via Quick Login"
                    >
                      Use saved
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-2">
                <input className="input" value="Cookie" readOnly />
                <div className="flex gap-2">
                  <input
                    className="input flex-1 font-mono text-xs"
                    placeholder="e.g. session=abc; XSRF-TOKEN=xyz"
                    value={cookieVal}
                    onChange={(e) => setCookieVal(e.target.value)}
                  />
                  {cookieHeader && cookieVal !== cookieHeader && (
                    <button
                      type="button"
                      className="btn-ghost text-xs whitespace-nowrap"
                      onClick={() => setCookieVal(cookieHeader)}
                      title="Use cookies captured via Quick Login"
                    >
                      Use saved
                    </button>
                  )}
                </div>
              </div>
              {xsrfToken && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 pl-[208px]">
                  ✓ X-Xsrf-Token header will be auto-added ({xsrfToken.slice(0, 12)}…)
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          {!["GET", "HEAD"].includes(ep.method.toUpperCase()) && (
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Request body (JSON)
                </div>
                {ep.request_schema && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:underline"
                    onClick={() =>
                      setBodyText(JSON.stringify(exampleFromSchema(ep.request_schema), null, 2))
                    }
                  >
                    Reset to example
                  </button>
                )}
              </div>
              <textarea
                className="input mt-2 font-mono text-xs"
                rows={Math.min(14, Math.max(4, bodyText.split("\n").length))}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder='{"key": "value"}'
              />
              {bodyError && <div className="text-xs text-rose-600 mt-1">{bodyError}</div>}
            </div>
          )}

          {/* Execute */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={execute}
              disabled={tryMut.isPending}
            >
              <Play className="w-4 h-4" />
              {tryMut.isPending ? "Executing…" : "Execute"}
            </button>
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(curlSnippet(ep.method, fullUrl, buildHeaders(), queryVals, bodyText));
              }}
              title="Copy curl"
            >
              <Copy className="w-3.5 h-3.5" /> Copy as curl
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30"
              onClick={() => setShowAiModal(true)}
              title="Auto-generate positive, negative, boundary and edge-case tests with assertions"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate AI Tests
            </button>
          </div>

          {/* Response */}
          {resp && (
            <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${statusTone(resp.status)}`}>
                    {resp.status || "ERR"}
                  </span>
                  <span className="text-xs text-slate-500">{resp.elapsed_ms} ms</span>
                  {resp.error && <span className="text-xs text-rose-600">{resp.error}</span>}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{resp.content_type}</span>
              </div>
              <details className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                <summary className="text-xs text-slate-500 cursor-pointer">
                  Headers ({Object.keys(resp.headers).length})
                </summary>
                <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-slate-600 dark:text-slate-300">
{Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
                </pre>
              </details>
              <pre className="bg-slate-950 text-emerald-300 text-[12px] font-mono p-3 overflow-auto max-h-96">
{prettify(resp.body, resp.content_type) || "(empty body)"}
              </pre>
            </div>
          )}

          {/* Possible responses spec */}
          {Object.keys(ep.responses || {}).length > 0 && (
            <details>
              <summary className="text-xs text-slate-500 cursor-pointer">
                Documented responses ({Object.keys(ep.responses).length})
              </summary>
              <ul className="mt-2 space-y-1">
                {Object.entries(ep.responses).map(([code, def]: any) => (
                  <li key={code} className="text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-mono mr-2 ${statusTone(Number(code) || 0)}`}>
                      {code}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {def?.description || ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {showAiModal && (
        <AiTestGeneratorModal
          endpointId={ep.id}
          method={ep.method}
          path={ep.path}
          baseUrl={serverUrl}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}

function ParamSection({
  title,
  params,
  values,
  onChange,
}: {
  title: string;
  params: ParamDef[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</div>
      <div className="space-y-2 mt-2">
        {params.map((p) => (
          <div key={p.name} className="grid grid-cols-[200px_1fr] gap-2 items-start">
            <div className="text-xs pt-2">
              <code className="font-mono">{p.name}</code>
              {p.required && <span className="text-rose-500 ml-1">*</span>}
              <div className="text-[10px] text-slate-400">{p.schema?.type || "string"}</div>
            </div>
            <div>
              {p.schema?.enum?.length ? (
                <select
                  className="input"
                  value={values[p.name] ?? ""}
                  onChange={(e) => onChange({ ...values, [p.name]: e.target.value })}
                >
                  <option value="">— select —</option>
                  {p.schema.enum.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder={p.description || String(p.example ?? p.schema?.example ?? "")}
                  value={values[p.name] ?? ""}
                  onChange={(e) => onChange({ ...values, [p.name]: e.target.value })}
                />
              )}
              {p.description && (
                <div className="text-[11px] text-slate-500 mt-1">{p.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function curlSnippet(
  method: string,
  url: string,
  headers: Record<string, string>,
  query: Record<string, string>,
  body: string
): string {
  const q = Object.entries(query)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const fullUrl = q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url;
  const parts = [`curl -X ${method.toUpperCase()} '${fullUrl}'`];
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`  -H '${k}: ${v.replace(/'/g, "'\\''")}'`);
  }
  if (body.trim() && !["GET", "HEAD"].includes(method.toUpperCase())) {
    parts.push(`  -H 'Content-Type: application/json'`);
    parts.push(`  --data '${body.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(" \\\n");
}

// --- Spec viewer (full page) ----------------------------------------------
function SpecViewer({ specId, onClose }: { specId: string; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["spec", specId],
    queryFn: async () => (await api.get<SpecDetail>(`/swagger/${specId}`)).data,
  });

  const eps = (data?.endpoints ?? []).filter((e) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      e.path.toLowerCase().includes(f) ||
      e.method.toLowerCase().includes(f) ||
      (e.summary || "").toLowerCase().includes(f) ||
      e.tags.some((t) => t.toLowerCase().includes(f))
    );
  });

  const groups = eps.reduce<Record<string, EndpointOut[]>>((acc, e) => {
    const key = e.tags[0] || "untagged";
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-sky-500" />
              {data?.name ?? "Loading…"}
            </h2>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                v{data.version} · OpenAPI {data.openapi_version} · {data.endpoint_count} endpoints
                {data.servers?.length ? ` · ${data.servers.length} server(s)` : ""}
              </p>
            )}
            {data?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl line-clamp-2">
                {data.description}
              </p>
            )}
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <input
            className="input"
            placeholder="Filter by method, path, summary, or tag…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="overflow-auto p-4 space-y-6 flex-1">
          {isLoading && <div className="text-sm text-slate-500">Loading endpoints…</div>}
          {!isLoading && eps.length === 0 && (
            <div className="text-sm text-slate-500">No endpoints match.</div>
          )}
          {Object.entries(groups).map(([tag, items]) => (
            <div key={tag}>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">
                {tag} <span className="text-slate-400">({items.length})</span>
              </h3>
              <div className="space-y-2">
                {items.map((e) => (
                  <EndpointRow key={e.id} ep={e} servers={data?.servers ?? []} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Presets / main page ---------------------------------------------------
const ZPE_PRESETS: { label: string; url: string; name: string }[] = [
  { label: "ZPECloud QA — User API", url: "https://api.qa-zpecloud.com/cloud-user-redoc", name: "ZPECloud User API (QA)" },
  { label: "ZPECloud QA — Device / Site Manage API", url: "https://api.qa-zpecloud.com/cloud-site-manage-redoc", name: "ZPECloud Device API (QA)" },
];

const LOGIN_PRESETS = [
  { label: "QA",      url: "https://api.qa-zpecloud.com/user/auth" },
  { label: "Staging", url: "https://api.staging-zpecloud.com/user/auth" },
  { label: "Prod",    url: "https://api.zpecloud.com/user/auth" },
];

function extractToken(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return (
      parsed?.access_token ||
      parsed?.accessToken ||
      parsed?.token ||
      parsed?.jwt ||
      parsed?.id_token ||
      parsed?.data?.access_token ||
      parsed?.data?.token ||
      null
    );
  } catch {
    return null;
  }
}

function fetchOAuthTokenPayload(args: {
  tokenUrl: string;
  grant: OAuthGrant;
  clientId: string;
  clientSecret: string;
  scope: string;
  username: string;
  password: string;
  clientAuth: "basic" | "body";
}): Promise<string> {
  const { tokenUrl, grant, clientId, clientSecret, scope, username, password, clientAuth } = args;
  if (grant === "manual") return Promise.reject(new Error("Paste a token or choose a grant type"));
  if (!tokenUrl.trim()) return Promise.reject(new Error("Token URL is required"));

  const form = new URLSearchParams();
  form.set("grant_type", grant);
  if (scope.trim()) form.set("scope", scope.trim());
  if (grant === "password") {
    if (!username.trim()) return Promise.reject(new Error("Username is required for password grant"));
    if (!password.trim()) return Promise.reject(new Error("Password is required for password grant"));
    form.set("username", username.trim());
    form.set("password", password.trim());
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (clientAuth === "basic" && clientId.trim()) {
    headers.Authorization = `Basic ${btoa(`${clientId.trim()}:${clientSecret}`)}`;
  } else if (clientAuth === "body" && clientId.trim()) {
    form.set("client_id", clientId.trim());
    if (clientSecret.trim()) form.set("client_secret", clientSecret.trim());
  }

  return fetch(tokenUrl.trim(), {
    method: "POST",
    headers,
    body: form.toString(),
  }).then(async (res) => {
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(data?.error_description || data?.error || `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!data.access_token) {
      throw new Error("Response did not contain access_token");
    }
    return `${data.token_type || "Bearer"} ${data.access_token}`.trim();
  });
}

function OAuthAccessPanel({
  onToken,
  defaultTokenUrl,
}: {
  onToken: (token: string) => void;
  defaultTokenUrl: string;
}) {
  const [grant, setGrant] = useState<OAuthGrant>("client_credentials");
  const [tokenUrl, setTokenUrl] = useState(defaultTokenUrl);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientAuth, setClientAuth] = useState<"basic" | "body">("basic");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (defaultTokenUrl) setTokenUrl(defaultTokenUrl);
  }, [defaultTokenUrl]);

  const fetchToken = async () => {
    setInfo(null);
    setErr(null);
    setBusy(true);
    try {
      const token = await fetchOAuthTokenPayload({
        tokenUrl,
        grant,
        clientId,
        clientSecret,
        scope,
        username,
        password,
        clientAuth,
      });
      onToken(token.replace(/^Bearer\s+/i, ""));
      setInfo("✓ OAuth access token saved for API requests below");
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch OAuth token");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-violet-200 dark:border-violet-900/70 bg-violet-50/60 dark:bg-violet-950/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            OAuth 2.0 access token
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Fetch a bearer token from your provider and reuse it for every API request.
          </div>
        </div>
        <span className="text-[11px] text-violet-700 dark:text-violet-300 font-mono">
          stored in zpe-cloud-auth
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 w-20">Grant</label>
          <select className="input h-8 text-xs flex-1" value={grant} onChange={(e) => setGrant(e.target.value as OAuthGrant)}>
            <option value="client_credentials">Client Credentials</option>
            <option value="password">Password Credentials</option>
            <option value="manual">Paste access token</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 w-20">Header prefix</label>
          <input className="input text-xs flex-1" value="Bearer" readOnly />
        </div>
      </div>

      {grant !== "manual" && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Token URL</label>
            <input className="input text-xs flex-1" placeholder="https://idp.example.com/oauth/token" value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Client ID</label>
            <input className="input text-xs flex-1" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Client Secret</label>
            <input className="input font-mono text-xs flex-1" type={showSecret ? "text" : "password"} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            <button type="button" className="text-[11px] text-slate-500 hover:underline" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Send creds</label>
            <select className="input h-8 text-xs flex-1" value={clientAuth} onChange={(e) => setClientAuth(e.target.value as "basic" | "body") }>
              <option value="basic">Basic Auth header</option>
              <option value="body">In request body</option>
            </select>
          </div>
          {grant === "password" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 w-20">Username</label>
                <input className="input text-xs flex-1" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 w-20">Password</label>
                <input className="input font-mono text-xs flex-1" type={showSecret ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 w-20">Scope</label>
            <input className="input text-xs flex-1" placeholder="read:users write:users" value={scope} onChange={(e) => setScope(e.target.value)} />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={fetchToken}>
          {busy ? "Fetching…" : grant === "manual" ? "Validate token workflow" : "Get access token"}
        </button>
        {info && <span className="text-[11px] text-emerald-600">{info}</span>}
        {err && <span className="text-[11px] text-rose-600">{err}</span>}
      </div>
    </div>
  );
}

type ParsedCurlRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  bodyKind: "json" | "text" | "form" | "none";
};

function tokenizeCurlCommand(input: string): string[] {
  const source = input.replace(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (quote) {
      if (quote === '"' && ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseCurlCommand(input: string): ParsedCurlRequest {
  const tokens = tokenizeCurlCommand(input);
  if (!tokens.length) throw new Error("Paste a curl command first");
  if (/^curl(\.exe)?$/i.test(tokens[0])) tokens.shift();
  if (!tokens.length) throw new Error("Paste a curl command first");

  let method = "GET";
  let url = "";
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  let body: any = null;
  let bodyKind: ParsedCurlRequest["bodyKind"] = "none";
  let dataText: string | null = null;
  let getMode = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token === "-X" || token === "--request") {
      method = (tokens[++i] || "GET").toUpperCase();
      continue;
    }

    if (token === "-H" || token === "--header") {
      const header = tokens[++i] || "";
      const idx = header.indexOf(":");
      if (idx > 0) {
        const name = header.slice(0, idx).trim();
        const value = header.slice(idx + 1).trim();
        if (name && value) headers[name] = value;
      }
      continue;
    }

    if (token === "-u" || token === "--user") {
      const userPass = tokens[++i] || "";
      if (userPass) headers.Authorization = `Basic ${btoa(userPass)}`;
      continue;
    }

    if (token === "-b" || token === "--cookie") {
      const cookie = tokens[++i] || "";
      if (cookie) headers.Cookie = cookie;
      continue;
    }

    if (token === "-G" || token === "--get") {
      getMode = true;
      method = "GET";
      continue;
    }

    if (token === "-I" || token === "--head") {
      method = "HEAD";
      continue;
    }

    if (token === "--json") {
      const raw = tokens[++i] || "";
      bodyKind = "json";
      method = method === "GET" ? "POST" : method;
      body = raw ? JSON.parse(raw) : null;
      headers["Content-Type"] = "application/json";
      continue;
    }

    if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary" || token === "--data-ascii") {
      const raw = tokens[++i] || "";
      if (!raw) continue;
      if (raw.startsWith("@")) {
        throw new Error("curl file uploads like @file are not supported here");
      }
      dataText = raw;
      method = method === "GET" ? "POST" : method;
      continue;
    }

    if (token === "--url") {
      url = tokens[++i] || url;
      continue;
    }

    if (!token.startsWith("-") && !url) {
      url = token;
      continue;
    }
  }

  if (!url) throw new Error("curl command does not contain a URL");

  if (dataText !== null && bodyKind === "none") {
    const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] || "";
    const raw = dataText.trim();
    if (getMode) {
      const params = new URLSearchParams(raw);
      params.forEach((value, key) => {
        query[key] = value;
      });
      bodyKind = "none";
      body = null;
    } else if (/application\/x-www-form-urlencoded/i.test(contentType)) {
      const params = new URLSearchParams(raw);
      body = Object.fromEntries(params.entries());
      bodyKind = "form";
    } else {
      try {
        body = JSON.parse(raw);
        bodyKind = "json";
        if (!contentType) headers["Content-Type"] = "application/json";
      } catch {
        body = raw;
        bodyKind = "text";
      }
    }
  }

  return { method, url, headers, query, body, bodyKind };
}

function QuickLoginCard() {
  const { selectedId } = useActiveEnv();
  const { data: envs } = useQuery({
    queryKey: ["envs-for-login"],
    queryFn: async () => (await api.get<EnvOut[]>("/environments")).data,
    staleTime: 60_000,
  });
  const activeEnv = useMemo(
    () => envs?.find((e) => e.id === selectedId) ?? null,
    [envs, selectedId]
  );

  const { token, email, cookies, setToken, setEmail, setCookies, clear } = useZpeAuth();
  const [loginUrl, setLoginUrl] = useState(() => {
    if (activeEnv?.base_url) return activeEnv.base_url.replace(/\/$/, "") + "/user/auth";
    return LOGIN_PRESETS[0].url;
  });
  useEffect(() => {
    if (activeEnv?.base_url) {
      setLoginUrl(activeEnv.base_url.replace(/\/$/, "") + "/user/auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnv?.id]);

  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [bodyText, setBodyText] = useState<string>("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [curlText, setCurlText] = useState<string>("");
  const [curlError, setCurlError] = useState<string | null>(null);
  const [resp, setResp] = useState<TryResponse | null>(null);
  const lastAutoRef = useRef<string>("");

  // Keep JSON body in sync with email/password helpers (unless user edited manually)
  const autoBody = useMemo(
    () => JSON.stringify({ email, password: pwd || "••••" }, null, 2),
    [email, pwd]
  );
  useEffect(() => {
    if (!bodyText || bodyText === lastAutoRef.current) {
      setBodyText(autoBody);
      lastAutoRef.current = autoBody;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBody]);

  const loginMut = useMutation({
    mutationFn: async (payload: any) =>
      (await api.post<TryResponse>("/swagger/try", payload)).data,
    onSuccess: (data) => {
      setResp(data);
      if (data.status >= 200 && data.status < 300) {
        const t = extractToken(data.body);
        if (t) setToken(t);
        if (data.cookies && Object.keys(data.cookies).length) {
          setCookies(data.cookies);
        }
      }
    },
    onError: (e: any) =>
      setResp({
        status: 0,
        elapsed_ms: 0,
        headers: {},
        cookies: {},
        body: e?.response?.data?.error?.message ?? String(e),
        content_type: "",
        error: "request failed",
      }),
  });

  function submit() {
    setBodyError(null);
    let parsedBody: any;
    // Prefer the JSON textarea if user edited it; otherwise build from helpers.
    const raw = bodyText.trim() || JSON.stringify({ email, password: pwd });
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      setBodyError("Body is not valid JSON");
      return;
    }
    // If they used the helper fields, ensure they win.
    if (email) parsedBody.email = email;
    if (pwd) parsedBody.password = pwd;
    loginMut.mutate({
      method: "POST",
      url: loginUrl,
      headers: { "Content-Type": "application/json" },
      body: parsedBody,
      body_kind: "json",
    });
  }

  function submitCurl() {
    setCurlError(null);
    try {
      const parsed = parseCurlCommand(curlText);
      loginMut.mutate({
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        query: parsed.query,
        body: parsed.body,
        body_kind: parsed.bodyKind,
      });
    } catch (e: any) {
      setCurlError(e?.message || "Invalid curl command");
    }
  }

  return (
    <div className="card p-6 space-y-4 border-2 border-emerald-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-emerald-500" />
          <div>
            <h2 className="font-semibold">Quick login (ZPE Cloud)</h2>
            <p className="text-xs text-slate-500">
              POST to <code className="font-mono">/user/auth</code>. Session cookies + token auto-attach to every endpoint below.
            </p>
          </div>
        </div>
        {(token || Object.keys(cookies).length > 0) ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> Signed in
            </span>
            {Object.keys(cookies).length > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                title={Object.keys(cookies).join(", ")}
              >
                🍪 {Object.keys(cookies).length} cookie{Object.keys(cookies).length === 1 ? "" : "s"}
              </span>
            )}
            {token && (
              <button
                type="button"
                className="btn-ghost text-xs inline-flex items-center gap-1"
                onClick={() => navigator.clipboard.writeText(token)}
              >
                <Copy className="w-3.5 h-3.5" /> Copy token
              </button>
            )}
            <button
              type="button"
              className="btn-ghost text-xs text-rose-600 inline-flex items-center gap-1"
              onClick={clear}
            >
              <LogOut className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Not signed in</span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Login URL {activeEnv && <span className="text-emerald-600">(env: {activeEnv.name})</span>}
          </label>
          <input
            className="input mt-1"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
          />
          <div className="flex gap-1 mt-2 flex-wrap">
            {LOGIN_PRESETS.map((p) => (
              <button
                key={p.url}
                type="button"
                className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => setLoginUrl(p.url)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
            <input
              className="input mt-1"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</label>
            <div className="flex gap-1 mt-1">
              <input
                className="input flex-1"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <OAuthAccessPanel
        onToken={(token) => setToken(token)}
        defaultTokenUrl={activeEnv?.base_url ? activeEnv.base_url.replace(/\/$/, "") + "/oauth/token" : ""}
      />

      <div className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Execute curl command
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Paste a curl command and run it through the same request proxy used by the API runner.
            </div>
          </div>
          <span className="text-[11px] text-slate-500">Supports common curl flags</span>
        </div>

        <textarea
          className="input mt-2 font-mono text-xs"
          rows={6}
          value={curlText}
          onChange={(e) => setCurlText(e.target.value)}
          placeholder={`curl -X POST 'https://api.example.com/items' \\
  -H 'Content-Type: application/json' \\
  --data '{"name":"demo"}'`}
        />
        {curlError && <div className="text-xs text-rose-600">{curlError}</div>}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={submitCurl}
            disabled={loginMut.isPending || !curlText.trim()}
          >
            <Play className="w-4 h-4" />
            {loginMut.isPending ? "Executing…" : "Run curl"}
          </button>
          <span className="text-xs text-slate-500">
            Flags: <code className="font-mono">-X</code>, <code className="font-mono">-H</code>, <code className="font-mono">-d</code>, <code className="font-mono">--json</code>, <code className="font-mono">-u</code>, <code className="font-mono">-b</code>.
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Request body (JSON)
          </label>
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => {
              const next = JSON.stringify({ email, password: pwd }, null, 2);
              setBodyText(next);
              lastAutoRef.current = next;
            }}
          >
            Sync from email + password
          </button>
        </div>
        <textarea
          className="input mt-2 font-mono text-xs"
          rows={6}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder='{"email":"you@example.com","password":"…"}'
        />
        {bodyError && <div className="text-xs text-rose-600 mt-1">{bodyError}</div>}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          onClick={submit}
          disabled={loginMut.isPending}
        >
          <LogIn className="w-4 h-4" />
          {loginMut.isPending ? "Signing in…" : "Login"}
        </button>
        <span className="text-xs text-slate-500">
          Credentials never leave your browser except in this POST. Token is stored in localStorage as <code>zpe-cloud-auth</code>.
        </span>
      </div>

      {resp && (
        <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${statusTone(resp.status)}`}>
                {resp.status || "ERR"}
              </span>
              <span className="text-xs text-slate-500">{resp.elapsed_ms} ms</span>
              {resp.error && <span className="text-xs text-rose-600">{resp.error}</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{resp.content_type}</span>
          </div>
          {resp.status >= 200 && resp.status < 300 && (extractToken(resp.body) || (resp.cookies && Object.keys(resp.cookies).length > 0)) && (
            <div className="px-3 py-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800 space-y-1">
              {extractToken(resp.body) && (
                <div>✓ Token saved — every endpoint's Bearer field below will use it.</div>
              )}
              {resp.cookies && Object.keys(resp.cookies).length > 0 && (
                <div>
                  🍪 Cookies captured: <code className="font-mono">{Object.keys(resp.cookies).join(", ")}</code> — auto-attached to all requests below.
                </div>
              )}
            </div>
          )}
          <pre className="bg-slate-950 text-emerald-300 text-[12px] font-mono p-3 overflow-auto max-h-72">
{prettify(resp.body, resp.content_type) || "(empty body)"}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function SwaggerUpload() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");

  const { data: specs } = useQuery({
    queryKey: ["specs"],
    queryFn: async () => (await api.get<SpecSummary[]>("/swagger")).data,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/swagger/upload", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => {
      setMsg("Upload successful");
      qc.invalidateQueries({ queryKey: ["specs"] });
    },
    onError: (e: any) => setMsg(e?.response?.data?.error?.message ?? "Upload failed"),
  });

  const importUrl = useMutation({
    mutationFn: async (payload: { url: string; name?: string }) =>
      (await api.post("/swagger/import-url", payload)).data,
    onSuccess: () => {
      setMsg("Imported from URL");
      setUrl("");
      setUrlName("");
      qc.invalidateQueries({ queryKey: ["specs"] });
    },
    onError: (e: any) => setMsg(e?.response?.data?.error?.message ?? "Import failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/swagger/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specs"] }),
  });

  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-title">API documentation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload an OpenAPI / Swagger spec, then explore endpoints with a built-in Try-it-out console — fill in URL, headers, body, and execute live requests.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold">Upload a spec file</h2>
          </div>
          <p className="text-sm text-slate-500">OpenAPI 2.0 / 3.x JSON or YAML.</p>
          <input ref={fileRef} type="file" accept=".json,.yml,.yaml" className="input" />
          <button
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              const f = fileRef.current?.files?.[0];
              if (f) upload.mutate(f);
            }}
            disabled={upload.isPending}
          >
            <Upload className="w-4 h-4" />
            {upload.isPending ? "Uploading…" : "Upload spec"}
          </button>
          {msg && <div className="text-sm text-emerald-600">{msg}</div>}
        </div>

        <div className="card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold">Import from URL</h2>
          </div>
          <p className="text-sm text-slate-500">
            Paste a Swagger/OpenAPI JSON, YAML, or ReDoc page URL. The dashboard auto-discovers the underlying spec.
          </p>
          <div className="flex flex-wrap gap-2">
            {ZPE_PRESETS.map((p) => (
              <div
                key={p.url}
                className="inline-flex items-stretch rounded-md overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
              >
                <button
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  type="button"
                  onClick={() => {
                    setUrl(p.url);
                    setUrlName(p.name);
                  }}
                >
                  {p.label}
                </button>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
              </div>
            ))}
          </div>
          <input
            className="input"
            placeholder="https://api.example.com/openapi.json or .../redoc"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="input"
            placeholder="Optional display name"
            value={urlName}
            onChange={(e) => setUrlName(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!url || importUrl.isPending}
            onClick={() => importUrl.mutate({ url, name: urlName || undefined })}
          >
            {importUrl.isPending ? "Importing…" : "Import from URL"}
          </button>
        </div>
      </div>

      <QuickLoginCard />

      <div className="card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th>Version</th>
              <th>OpenAPI</th>
              <th>Endpoints</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {specs?.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td>{s.version}</td>
                <td>{s.openapi_version}</td>
                <td>{s.endpoint_count}</td>
                <td>{new Date(s.created_at).toLocaleString()}</td>
                <td className="space-x-2 pr-4 text-right">
                  <button className="btn-primary text-xs" onClick={() => setViewing(s.id)}>
                    Explore
                  </button>
                  <button className="btn-ghost text-rose-600 text-xs" onClick={() => remove.mutate(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!specs?.length && (
              <tr>
                <td colSpan={6} className="text-center p-6 text-slate-500">
                  No specs uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <SpecViewer specId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
