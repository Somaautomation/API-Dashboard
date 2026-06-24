import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { Copy, Play, Trash2, ServerCog, CheckCircle2, XCircle } from "lucide-react";

interface Mock {
  id: string;
  name: string;
  method: string;
  path: string;
  status_code: number;
  delay_ms: number;
  enabled: boolean;
  headers?: Record<string, string>;
  response_body?: any;
  response_schema?: any;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const METHOD_BADGE: Record<string, string> = {
  GET:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  POST:   "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  PUT:    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  PATCH:  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
};

const EMPTY_FORM = {
  name: "",
  method: "GET" as string,
  path: "/example",
  status_code: 200,
  delay_ms: 0,
  enabled: true,
  headers: '{\n  "Content-Type": "application/json"\n}',
  response_body: '{\n  "hello": "world"\n}',
  response_schema: "",
};

export default function Mocks() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [parseError, setParseError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    status: number;
    ok: boolean;
    body: string;
    durationMs: number;
  } | null>(null);

  const apiBase = useMemo(
    () => api.defaults.baseURL?.replace(/\/+$/, "") ?? "",
    [],
  );

  const { data: mocks, isLoading } = useQuery({
    queryKey: ["mocks"],
    queryFn: async () => (await api.get<Mock[]>("/mocks")).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      setParseError(null);
      let headers: Record<string, string> = {};
      let response_body: any = null;
      let response_schema: any = null;
      try {
        if (form.headers.trim()) headers = JSON.parse(form.headers);
      } catch { throw new Error("Headers must be valid JSON object"); }
      try {
        if (form.response_body.trim()) response_body = JSON.parse(form.response_body);
      } catch { throw new Error("Response body must be valid JSON"); }
      try {
        if (form.response_schema.trim()) response_schema = JSON.parse(form.response_schema);
      } catch { throw new Error("Response schema must be valid JSON"); }

      return (await api.post("/mocks", {
        name: form.name,
        method: form.method,
        path: form.path.startsWith("/") ? form.path : `/${form.path}`,
        status_code: form.status_code,
        delay_ms: form.delay_ms,
        enabled: form.enabled,
        headers,
        response_body,
        response_schema,
      })).data;
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["mocks"] });
    },
    onError: (err: any) => setParseError(err?.message ?? "Failed to create mock"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/mocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mocks"] }),
  });

  const mockUrl = (m: Mock) =>
    `${apiBase}/mocks/run${m.path.startsWith("/") ? m.path : "/" + m.path}`;

  async function testMock(m: Mock) {
    setTestResult(null);
    const url = mockUrl(m);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: m.method });
      const text = await res.text();
      setTestResult({
        id: m.id,
        status: res.status,
        ok: res.ok,
        body: text,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      setTestResult({
        id: m.id,
        status: 0,
        ok: false,
        body: String(e?.message ?? e),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="h-title flex items-center gap-2">
            <ServerCog className="text-fuchsia-500" /> Mock APIs
          </h1>
          <p className="text-sm text-slate-500">
            Define stub endpoints served from <code className="font-mono text-xs">/api/v1/mocks/run/&lt;path&gt;</code>
          </p>
        </div>
        <span className="badge-violet">{mocks?.length ?? 0} mocks</span>
      </div>

      {/* Create form */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm bg-gradient-brand bg-clip-text text-transparent">
          Create a new mock
        </h2>

        <div className="grid md:grid-cols-6 gap-3">
          <input
            className="input md:col-span-2"
            placeholder="Mock name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="input"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            {METHODS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input
            className="input md:col-span-2"
            placeholder="/path"
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 accent-brand-500"
            />
            Enabled
          </label>

          <input
            className="input"
            type="number"
            placeholder="Status"
            value={form.status_code}
            onChange={(e) => setForm({ ...form, status_code: +e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Delay (ms)"
            value={form.delay_ms}
            onChange={(e) => setForm({ ...form, delay_ms: +e.target.value })}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500">Headers (JSON)</label>
            <textarea
              className="input font-mono text-xs mt-1 h-32"
              value={form.headers}
              onChange={(e) => setForm({ ...form, headers: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Response body (JSON)</label>
            <textarea
              className="input font-mono text-xs mt-1 h-32"
              value={form.response_body}
              onChange={(e) => setForm({ ...form, response_body: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">
              Dynamic schema (JSON Schema · optional, overrides body)
            </label>
            <textarea
              className="input font-mono text-xs mt-1 h-32"
              placeholder='{"type":"object","properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"}}}'
              value={form.response_schema}
              onChange={(e) => setForm({ ...form, response_schema: e.target.value })}
            />
          </div>
        </div>

        {parseError && <div className="text-sm text-rose-600">{parseError}</div>}

        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            disabled={!form.name || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Saving…" : "Create mock"}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setParseError(null); }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Mock list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500
                            bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-2 py-2">Method</th>
              <th className="px-2 py-2">Path</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Delay</th>
              <th className="px-2 py-2">State</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {!isLoading && (mocks?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                No mocks yet — create one above.
              </td></tr>
            )}
            {mocks?.map((x) => (
              <>
                <tr key={x.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2 font-medium">{x.name}</td>
                  <td className="px-2 py-2">
                    <span className={`badge ${METHOD_BADGE[x.method] ?? "badge-info"}`}>{x.method}</span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{x.path}</td>
                  <td className="px-2 py-2">{x.status_code}</td>
                  <td className="px-2 py-2">{x.delay_ms} ms</td>
                  <td className="px-2 py-2">
                    {x.enabled
                      ? <span className="badge-success">enabled</span>
                      : <span className="badge-warn">disabled</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-ghost"
                        title="Copy URL"
                        onClick={() => copy(mockUrl(x))}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="btn-secondary"
                        title="Test"
                        onClick={() => testMock(x)}
                      >
                        <Play size={14} /> Test
                      </button>
                      <button
                        className="btn-ghost text-rose-600"
                        title="Delete"
                        onClick={() => del.mutate(x.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {testResult?.id === x.id && (
                  <tr key={`${x.id}-result`} className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        {testResult.ok
                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                          : <XCircle size={14} className="text-rose-500" />}
                        <span className="font-medium">HTTP {testResult.status || "ERR"}</span>
                        <span className="text-slate-500">· {testResult.durationMs} ms</span>
                        <span className="text-slate-400 font-mono break-all">{mockUrl(x)}</span>
                      </div>
                      <pre className="mt-2 text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-64">
{tryPretty(testResult.body)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function tryPretty(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); }
  catch { return s; }
}

