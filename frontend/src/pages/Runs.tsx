import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

interface RunSummary {
  id: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  created_at: string;
}

interface AssertionRow {
  item_name: string;
  assertion_type: string;
  passed: boolean;
  message: string;
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

interface RunDetail extends RunSummary {
  assertions: AssertionRow[];
  collection_id?: string;
  summary?: { pass_rate?: number; items?: RunItemResult[] };
}

function statusBadge(status: string) {
  const base = "badge text-xs px-2 py-0.5 rounded";
  if (status === "passed") return `${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300`;
  if (status === "failed") return `${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300`;
  if (status === "running") return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
  return `${base} bg-slate-100 dark:bg-slate-800`;
}

function methodColor(m?: string) {
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
    } catch {
      /* fall through */
    }
  }
  return body;
}

function RequestPanel({ items }: { items: RunItemResult[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(items.length ? 0 : null);
  if (!items.length) {
    return (
      <div className="text-xs text-slate-500 italic">
        No per-request data captured (run was created before response capture was enabled).
      </div>
    );
  }
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((it, i) => {
        const open = openIdx === i;
        return (
          <div key={i}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
              onClick={() => setOpenIdx(open ? null : i)}
            >
              <span className="text-slate-400 text-xs w-4">{open ? "▾" : "▸"}</span>
              <span className={`badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method)}`}>
                {it.method || "?"}
              </span>
              {it.error ? (
                <span className="badge px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                  ERR
                </span>
              ) : (
                <span className={`badge px-1.5 py-0.5 text-[10px] font-bold ${statusCodeColor(it.status_code)}`}>
                  {it.status_code}
                </span>
              )}
              <span className="text-xs font-medium">{it.name}</span>
              <span className="text-xs font-mono text-slate-500 truncate flex-1" title={it.url}>
                {it.url}
              </span>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {it.duration_ms ?? 0} ms
              </span>
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-2 bg-slate-50/60 dark:bg-slate-900/30">
                {it.error && (
                  <div className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all">
                    {it.error}
                  </div>
                )}
                {it.response_headers && Object.keys(it.response_headers).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-500">
                      Response headers ({Object.keys(it.response_headers).length})
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] overflow-auto max-h-40">
                      {Object.entries(it.response_headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n")}
                    </pre>
                  </details>
                )}
                {it.response_body !== undefined && (
                  <details open className="text-xs">
                    <summary className="cursor-pointer text-slate-500">
                      Response body{" "}
                      {it.response_size !== undefined && (
                        <span className="text-slate-400">({it.response_size} bytes{it.response_truncated ? ", truncated to 8 KB" : ""})</span>
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
  );
}

export default function Runs() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: runs, isLoading, refetch } = useQuery({
    queryKey: ["runs"],
    queryFn: async () => (await api.get<RunSummary[]>("/runs")).data,
    refetchInterval: 5000,
  });

  const { data: detail } = useQuery({
    queryKey: ["run", selectedId],
    queryFn: async () => (await api.get<RunDetail>(`/runs/${selectedId}`)).data,
    enabled: !!selectedId,
  });

  const rerun = useMutation({
    mutationFn: async (collectionId: string) =>
      (await api.post(`/runs`, { collection_id: collectionId, variables: {} })).data as RunDetail,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      setSelectedId(r.id);
    },
    onError: (e: any) =>
      alert(`Re-run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
  });

  function reportUrl(id: string, kind: "pdf" | "excel") {
    return `${api.defaults.baseURL}/reports/runs/${id}/${kind}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Execution Reports</h1>
        <button className="btn-ghost border border-slate-200 dark:border-slate-700" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-slate-200 dark:border-slate-800">
            Runs {runs ? `(${runs.length})` : ""}
          </div>
          <div className="max-h-[70vh] overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
            {runs?.length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                No runs yet. Trigger one from the <b>Collections</b> page.
              </div>
            )}
            {runs?.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  selectedId === r.id ? "bg-slate-100 dark:bg-slate-800/70" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={statusBadge(r.status)}>{r.status}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono truncate">{r.id}</div>
                <div className="mt-1 text-xs">
                  <span className="text-green-600">{r.passed} passed</span>
                  {" · "}
                  <span className="text-red-600">{r.failed} failed</span>
                  {" · "}
                  <span className="text-slate-500">{r.duration_ms} ms</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          {!selectedId && <div className="text-sm text-slate-500">Select a run to see assertion details.</div>}
          {selectedId && !detail && <div className="text-sm text-slate-500">Loading run…</div>}
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(detail.status)}>{detail.status}</span>
                    <span className="text-sm">
                      {detail.passed}/{detail.total} passed · {detail.duration_ms} ms
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{detail.id}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={!detail.collection_id || rerun.isPending}
                    onClick={() => detail.collection_id && rerun.mutate(detail.collection_id)}
                    title="Re-run the same collection"
                  >
                    {rerun.isPending ? "Re-running…" : "Re-run"}
                  </button>
                  <a
                    className="btn-ghost border border-slate-200 dark:border-slate-700"
                    href={reportUrl(detail.id, "pdf")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                  <a
                    className="btn-ghost border border-slate-200 dark:border-slate-700"
                    href={reportUrl(detail.id, "excel")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Excel
                  </a>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Requests &amp; responses</div>
                <RequestPanel items={detail.summary?.items ?? []} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="text-left py-2 pr-3">Item</th>
                      <th className="text-left py-2 pr-3">Assertion</th>
                      <th className="text-left py-2 pr-3">Result</th>
                      <th className="text-left py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detail.assertions?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 text-slate-500">
                          No assertions recorded.
                        </td>
                      </tr>
                    )}
                    {detail.assertions?.map((a, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 font-medium">{a.item_name}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{a.assertion_type}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              a.passed
                                ? "text-green-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {a.passed ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{a.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

