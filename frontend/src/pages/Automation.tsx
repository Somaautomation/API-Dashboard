import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Play, Square, Copy, Check, RefreshCw, Eye } from "lucide-react";
import { useActiveEnv } from "@/store/env";

const LS_KEY = "automation-form";

interface Collection {
  id: string;
  name: string;
  description?: string;
}
const k6VusDefault = 50;
const k6DurationDefault = 120;
const k6P95Default = 500;

interface Environment {
  id: string;
  name: string;
}

interface RunOut {
  id: string;
  collection_id?: string | null;
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  created_at: string;
}

interface IterationResult {
  index: number;
  runId?: string;
  status: "running" | "passed" | "failed" | "error";
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  error?: string;
}

function statusBadge(s: string) {
  switch (s) {
    case "passed":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "running":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    case "error":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost text-xs flex items-center gap-1"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function Automation() {
  const qc = useQueryClient();
  const activeEnvId = useActiveEnv((s) => s.selectedId);

  // Restore persisted form (lazy initialisers).
  const initial = (() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [collectionId, setCollectionId] = useState<string>(initial?.collectionId ?? "");
  const [environmentId, setEnvironmentId] = useState<string>(initial?.environmentId ?? activeEnvId ?? "");
  const [iterations, setIterations] = useState<number>(initial?.iterations ?? 1);
  const [delayMs, setDelayMs] = useState<number>(initial?.delayMs ?? 0);
  const [failFast, setFailFast] = useState<boolean>(initial?.failFast ?? false);
  const [variablesText, setVariablesText] = useState<string>(initial?.variablesText ?? "{}");
  const [k6Vus, setK6Vus] = useState<number>(initial?.k6Vus ?? k6VusDefault);
  const [k6Duration, setK6Duration] = useState<number>(initial?.k6Duration ?? k6DurationDefault);
  const [k6P95, setK6P95] = useState<number>(initial?.k6P95 ?? k6P95Default);
  const [tab, setTab] = useState<"runner" | "snippets" | "history">("runner");
  const [running, setRunning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [iterResults, setIterResults] = useState<IterationResult[]>([]);
  const [drilling, setDrilling] = useState<string | null>(null);

  // If user has never chosen a per-page env, follow the top-bar selection.
  useEffect(() => {
    if (!initial?.environmentId && activeEnvId && !environmentId) {
      setEnvironmentId(activeEnvId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvId]);

  // Persist form on change.
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          collectionId,
          environmentId,
          iterations,
          delayMs,
          failFast,
          variablesText,
          k6Vus,
          k6Duration,
          k6P95,
        })
      );
    } catch {
      /* ignore quota */
    }
  }, [collectionId, environmentId, iterations, delayMs, failFast, variablesText, k6Vus, k6Duration, k6P95]);

  const collections = useQuery<Collection[]>({
    queryKey: ["automation-collections"],
    queryFn: async () => (await api.get("/collections")).data,
  });

  const environments = useQuery<Environment[]>({
    queryKey: ["automation-environments"],
    queryFn: async () => (await api.get("/environments")).data,
  });

  const runs = useQuery<RunOut[]>({
    queryKey: ["automation-runs"],
    queryFn: async () => (await api.get("/runs", { params: { limit: 20 } })).data,
    refetchInterval: tab === "history" ? 5000 : false,
  });

  const k6Script = useQuery<string>({
    queryKey: ["automation-k6-script", collectionId, k6Vus, k6Duration, k6P95],
    queryFn: async () => {
      const { data } = await api.get<string>(`/loadtest/${collectionId}/script`, {
        params: {
          tool: "k6",
          vus: k6Vus,
          duration_seconds: k6Duration,
          p95_ms: k6P95,
        },
        responseType: "text",
      });
      return data;
    },
    enabled: !!collectionId,
  });

  const collection = useMemo(
    () => collections.data?.find((c) => c.id === collectionId),
    [collections.data, collectionId]
  );

  const aggregate = useMemo(() => {
    const done = iterResults.filter((r) => r.status !== "running");
    const passedRequests = done.reduce((a, r) => a + r.passed, 0);
    const totalRequests = done.reduce((a, r) => a + r.total, 0);
    return {
      done: done.length,
      total: iterResults.length,
      passed: passedRequests,
      failed: done.reduce((a, r) => a + r.failed, 0),
      requests: totalRequests,
      avg: done.length
        ? Math.round(done.reduce((a, r) => a + r.duration_ms, 0) / done.length)
        : 0,
      passRate: totalRequests ? Math.round((passedRequests / totalRequests) * 100) : 0,
      progress: iterResults.length ? Math.round((done.length / iterResults.length) * 100) : 0,
    };
  }, [iterResults]);

  async function runNow() {
    if (!collectionId) return;
    let parsedVars: Record<string, string> = {};
    try {
      parsedVars = JSON.parse(variablesText || "{}");
    } catch {
      alert("Variables must be valid JSON (object of string→string)");
      return;
    }

    const n = Math.max(1, Math.min(100, Number(iterations) || 1));
    setRunning(true);
    setCancelRequested(false);
    setIterResults(
      Array.from({ length: n }, (_, i) => ({
        index: i + 1,
        status: "running" as const,
        total: 0,
        passed: 0,
        failed: 0,
        duration_ms: 0,
      }))
    );

    for (let i = 0; i < n; i++) {
      if (cancelRequested) break;
      try {
        const { data } = await api.post("/runs", {
          collection_id: collectionId,
          environment_id: environmentId || null,
          variables: parsedVars,
        });
        setIterResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  runId: data.id,
                  status: data.status,
                  total: data.total,
                  passed: data.passed,
                  failed: data.failed,
                  duration_ms: data.duration_ms,
                }
              : r
          )
        );
        if (failFast && data.status !== "passed") break;
      } catch (e: any) {
        setIterResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "error",
                  error: e?.response?.data?.detail || e?.message || "Request failed",
                }
              : r
          )
        );
        if (failFast) break;
      }
      if (delayMs > 0 && i < n - 1) await sleep(delayMs);
    }

    setRunning(false);
    qc.invalidateQueries({ queryKey: ["automation-runs"] });
  }

  const baseUrl =
    (import.meta as any).env?.VITE_API_BASE_URL ?? "https://api.qa-zpecloud.com/api/v1";

  const curlSnippet = `# Trigger a collection run from any CI / shell
curl -X POST ${baseUrl}/runs \\
  -H "Authorization: Bearer $ZPE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(
    {
      collection_id: collectionId || "<COLLECTION_ID>",
      environment_id: environmentId || null,
      variables: {},
    },
    null,
    2
  )}'`;

  const ghaSnippet = `# .github/workflows/api-tests.yml
name: API Regression
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 */6 * * *" }]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ZPE API Platform run
        env:
          ZPE_API_TOKEN: \${{ secrets.ZPE_API_TOKEN }}
        run: |
          curl -fsSL -X POST ${baseUrl}/runs \\
            -H "Authorization: Bearer $ZPE_API_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{
              "collection_id": "${collectionId || "<COLLECTION_ID>"}",
              "environment_id": ${environmentId ? `"${environmentId}"` : "null"},
              "variables": {}
            }' | tee result.json
          jq -e '.status == "passed"' result.json`;

  const nodeSnippet = `// Node 20+ — kick off a run from any pipeline
const res = await fetch("${baseUrl}/runs", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.ZPE_API_TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    collection_id: "${collectionId || "<COLLECTION_ID>"}",
    environment_id: ${environmentId ? `"${environmentId}"` : "null"},
    variables: {},
  }),
});
const run = await res.json();
if (run.status !== "passed") process.exit(1);`;

  const pyScript = `# python 3.9+ — schedule from cron / airflow / jenkins
import os, sys, requests

r = requests.post(
    "${baseUrl}/runs",
    headers={"Authorization": f"Bearer {os.environ['ZPE_API_TOKEN']}"},
    json={
        "collection_id": "${collectionId || "<COLLECTION_ID>"}",
        "environment_id": ${environmentId ? `"${environmentId}"` : "None"},
        "variables": {},
    },
    timeout=300,
)
r.raise_for_status()
data = r.json()
print(f"{data['passed']}/{data['total']} passed in {data['duration_ms']}ms")
sys.exit(0 if data["status"] == "passed" else 1)`;

  const k6RunCommand = collectionId
    ? `k6 run zpe-${collection?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "loadtest"}.js`
    : "k6 run zpe-loadtest.js";

  function downloadK6Script() {
    if (!k6Script.data) return;
    const blob = new Blob([k6Script.data], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zpe-${collection?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "loadtest"}.js`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API Automation</h1>
          <p className="text-sm text-slate-500">
            Postman-style collection runner. Execute, iterate, schedule, and integrate with CI.
          </p>
        </div>
        <div className="flex gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
          {(["runner", "snippets", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-md capitalize ${
                tab === t
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "runner" && (
        <>
          {/* Runner config */}
          <div className="card p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Collection</label>
                <select
                  className="input mt-1"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  disabled={collections.isLoading}
                >
                  <option value="">
                    {collections.isLoading ? "Loading…" : "— Select a collection —"}
                  </option>
                  {collections.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Environment</label>
                <select
                  className="input mt-1"
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {environments.data?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Iterations</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input mt-1"
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Delay between iterations (ms)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="input mt-1"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500">
                  Runtime variables (JSON, overrides environment)
                </label>
                <textarea
                  className="input font-mono text-xs mt-1"
                  rows={4}
                  value={variablesText}
                  onChange={(e) => setVariablesText(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <label className="text-xs flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={failFast}
                    onChange={(e) => setFailFast(e.target.checked)}
                  />
                  Stop on first failure (fail-fast)
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {!running ? (
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={!collectionId}
                  onClick={runNow}
                >
                  <Play size={14} /> Run now
                </button>
              ) : (
                <button
                  className="btn-ghost flex items-center gap-2 text-rose-600"
                  onClick={() => setCancelRequested(true)}
                >
                  <Square size={14} /> Cancel
                </button>
              )}
              {collection && (
                <span className="text-xs text-slate-500">
                  Target: <span className="font-medium">{collection.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* k6 section */}
          <div className="card p-4 space-y-4 border border-violet-200 dark:border-violet-900/50">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                  k6 test cases
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate a ready-to-run k6 script from the selected collection and execute it locally with k6.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={() => k6Script.refetch()}
                  disabled={!collectionId || k6Script.isFetching}
                >
                  <RefreshCw size={12} className={k6Script.isFetching ? "animate-spin" : ""} />
                  Refresh script
                </button>
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={downloadK6Script}
                  disabled={!k6Script.data}
                >
                  Download script
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500">Virtual users</label>
                <input
                  type="number"
                  min={1}
                  className="input mt-1"
                  value={k6Vus}
                  onChange={(e) => setK6Vus(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Ramp-up / duration preview</label>
                <input
                  type="number"
                  min={1}
                  className="input mt-1"
                  value={k6Duration}
                  onChange={(e) => setK6Duration(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">P95 threshold (ms)</label>
                <input
                  type="number"
                  min={1}
                  className="input mt-1"
                  value={k6P95}
                  onChange={(e) => setK6P95(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <CopyButton text={k6Script.data || ""} />
              <CopyButton text={k6RunCommand} />
              <span className="text-xs text-slate-500">
                Run it from your shell after installing k6.
              </span>
            </div>

            <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Generated k6 script</div>
                <pre className="text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-96 rounded-md whitespace-pre-wrap">
{k6Script.isLoading
  ? "Loading script…"
  : k6Script.isError
  ? "Failed to load k6 script"
  : k6Script.data || "Select a collection to generate a script."}
                </pre>
              </div>
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Run command
                  </div>
                  <code className="block text-[11px] font-mono break-all bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2">
                    {k6RunCommand}
                  </code>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 space-y-2">
                  <div className="font-semibold text-slate-600 dark:text-slate-300">
                    What this does
                  </div>
                  <p>
                    The script is generated from the selected collection’s requests and stages the test with the k6 options shown above.
                  </p>
                  <p>
                    Save the script as a <code className="font-mono">.js</code> file, then run <code className="font-mono">k6 run &lt;file&gt;</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Aggregate + iteration grid */}
          {iterResults.length > 0 && (
            <div className="card p-4 space-y-3">
              {running && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded h-2 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${aggregate.progress}%` }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                <Stat label="Iterations" value={`${aggregate.done}/${aggregate.total}`} />
                <Stat label="Requests" value={aggregate.requests} />
                <Stat
                  label="Pass rate"
                  value={`${aggregate.passRate}%`}
                  cls={
                    aggregate.passRate === 100
                      ? "text-emerald-600 dark:text-emerald-400"
                      : aggregate.passRate >= 80
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                />
                <Stat
                  label="Passed"
                  value={aggregate.passed}
                  cls="text-emerald-600 dark:text-emerald-400"
                />
                <Stat
                  label="Failed"
                  value={aggregate.failed}
                  cls="text-rose-600 dark:text-rose-400"
                />
                <Stat label="Avg ms" value={aggregate.avg} />
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
                {iterResults.map((r) => (
                  <div
                    key={r.index}
                    className="flex items-center gap-3 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-slate-400 w-10">#{r.index}</span>
                    <span
                      className={`badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`}
                    >
                      {r.status}
                    </span>
                    <span>
                      {r.passed}/{r.total} passed
                    </span>
                    <span className="text-slate-500">· {r.duration_ms} ms</span>
                    {r.error && (
                      <span className="text-rose-500 truncate">— {r.error}</span>
                    )}
                    {r.runId && (
                      <>
                        <button
                          className="btn-ghost text-[11px] flex items-center gap-1 ml-auto"
                          onClick={() => setDrilling(r.runId!)}
                          title="View per-request results"
                        >
                          <Eye size={12} /> View
                        </button>
                        <span className="font-mono text-slate-400">
                          {r.runId.slice(0, 8)}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "snippets" && (
        <div className="space-y-4">
          <div className="card p-4 text-xs text-slate-500">
            Snippets below are pre-filled with your current selection (collection +
            environment). Use them to trigger the same run from CI/CD, cron, or any
            scripting language. Authenticate with a personal API token from{" "}
            <span className="font-medium">Settings → Tokens</span>.
          </div>
          <Snippet title="cURL" lang="bash" code={curlSnippet} />
          <Snippet title="GitHub Actions" lang="yaml" code={ghaSnippet} />
          <Snippet title="Node.js" lang="javascript" code={nodeSnippet} />
          <Snippet title="Python" lang="python" code={pyScript} />
        </div>
      )}

      {tab === "history" && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
            <div className="text-sm font-medium">Recent automation runs</div>
            <button
              className="btn-ghost text-xs flex items-center gap-1"
              onClick={() => runs.refetch()}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Run ID</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Pass / Total</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-2 font-mono text-slate-400">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.passed}/{r.total}
                  </td>
                  <td className="px-4 py-2">{r.duration_ms} ms</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="btn-ghost text-[11px] flex items-center gap-1"
                      onClick={() => setDrilling(r.id)}
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {(runs.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No runs yet — trigger one from the Runner tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {drilling && (
        <RunDrillModal runId={drilling} onClose={() => setDrilling(null)} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  cls = "",
}: {
  label: string;
  value: string | number;
  cls?: string;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Snippet({ title, lang, code }: { title: string; lang: string; code: string }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="text-xs font-medium">
          {title} <span className="text-slate-400">· {lang}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-96 whitespace-pre">
{code}
      </pre>
    </div>
  );
}

interface RunDetailItem {
  name: string;
  method?: string;
  url?: string;
  status_code?: number;
  duration_ms?: number;
  response_body?: string;
  error?: string;
}
interface RunDetail {
  id: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  summary?: { items?: RunDetailItem[]; pass_rate?: number };
  assertions?: { item_name: string; assertion_type: string; passed: boolean; message: string }[];
}

function RunDrillModal({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<RunDetail>({
    queryKey: ["run-detail", runId],
    queryFn: async () => (await api.get(`/runs/${runId}`)).data,
  });

  const items = data?.summary?.items ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-5xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">
              Run details
              {data && (
                <span
                  className={`ml-2 badge px-1.5 py-0.5 text-[11px] font-bold ${statusBadge(data.status)}`}
                >
                  {data.status}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{runId}</p>
            {data && (
              <p className="text-xs text-slate-500 mt-1">
                {data.passed}/{data.total} passed · {data.duration_ms} ms
              </p>
            )}
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="overflow-auto p-4 space-y-3 flex-1">
          {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
          {!isLoading && items.length === 0 && (
            <div className="text-sm text-slate-500">No per-request data captured.</div>
          )}
          {items.map((it, idx) => (
            <details
              key={idx}
              className="border border-slate-200 dark:border-slate-700 rounded"
            >
              <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs">
                <span className="font-mono w-6 text-slate-400">#{idx + 1}</span>
                {it.method && (
                  <span className="badge px-1.5 py-0.5 font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {it.method}
                  </span>
                )}
                {typeof it.status_code === "number" && (
                  <span
                    className={`badge px-1.5 py-0.5 font-bold ${
                      it.status_code < 300
                        ? "bg-emerald-100 text-emerald-700"
                        : it.status_code < 400
                        ? "bg-sky-100 text-sky-700"
                        : it.status_code < 500
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {it.status_code}
                  </span>
                )}
                <span className="flex-1 truncate font-mono">{it.url || it.name}</span>
                {typeof it.duration_ms === "number" && (
                  <span className="text-slate-500">{it.duration_ms} ms</span>
                )}
                {it.error && <span className="text-rose-500 text-[11px]">ERR</span>}
              </summary>
              <div className="p-3 space-y-2 text-xs border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  {it.name}
                </div>
                {it.error && (
                  <div className="text-rose-600 font-mono text-[11px]">{it.error}</div>
                )}
                {it.response_body && (
                  <pre className="bg-slate-950 text-emerald-300 text-[11px] font-mono p-2 rounded overflow-auto max-h-72">
{(() => {
  try {
    return JSON.stringify(JSON.parse(it.response_body!), null, 2);
  } catch {
    return it.response_body;
  }
})()}
                  </pre>
                )}
                {(data?.assertions ?? []).filter((a) => a.item_name === it.name).map((a, i) => (
                  <div
                    key={i}
                    className={`text-[11px] px-2 py-1 rounded ${
                      a.passed
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                    }`}
                  >
                    {a.passed ? "✓" : "✗"} <code>{a.assertion_type}</code> — {a.message}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
