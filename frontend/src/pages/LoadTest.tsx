import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play, Copy, Download, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";
import ChartCard from "@/components/charts/ChartCard";
import { PALETTE, tooltipStyle } from "@/components/charts/palette";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface Environment {
  id: string;
  name: string;
  base_url: string;
}

interface LoadTestResponse {
  status: string;
  exit_code: number | null;
  elapsed_ms: number;
  stdout: string;
  stderr: string;
  script: string;
}

interface ParsedK6Metrics {
  totalRequests: number | null;
  requestsPerSecond: number | null;
  checksPassed: number | null;
  checksFailed: number | null;
  checksPassPercent: number | null;
  errorRatePercent: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  maxLatencyMs: number | null;
}

function parseDurationToMs(input: string): number | null {
  const raw = input.trim();
  const match = raw.match(/^([0-9]*\.?[0-9]+)\s*(us|µs|ms|s|m)$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value)) return null;
  if (unit === "us" || unit === "µs") return value / 1000;
  if (unit === "ms") return value;
  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60 * 1000;
  return null;
}

function parseK6Stdout(stdout: string): ParsedK6Metrics | null {
  if (!stdout.trim()) return null;

  const numberFrom = (value: string | undefined): number | null => {
    if (!value) return null;
    const n = Number(value.replaceAll(",", ""));
    return Number.isFinite(n) ? n : null;
  };

  const totalReqMatch = stdout.match(/^\s*http_reqs\.*:\s*([\d,]+)/m);
  const rpsMatch = stdout.match(/^\s*http_reqs\.*:\s*[\d,]+\s+([0-9]*\.?[0-9]+)\/s/m);
  const checksMatch = stdout.match(/^\s*checks\.*:\s*([0-9]*\.?[0-9]+)%\s*✓\s*([\d,]+)\s*✗\s*([\d,]+)/m);
  const errorRateMatch = stdout.match(/^\s*http_req_failed\.*:\s*([0-9]*\.?[0-9]+)%/m);

  const durationLine = stdout.match(/^\s*http_req_duration\.*:.*$/m)?.[0] ?? "";
  const durationTokens = new Map<string, string>();
  for (const token of durationLine.matchAll(/([a-zA-Z0-9()]+)=([0-9]*\.?[0-9]+(?:us|µs|ms|s|m))/g)) {
    durationTokens.set(token[1], token[2]);
  }

  const parsed: ParsedK6Metrics = {
    totalRequests: numberFrom(totalReqMatch?.[1]),
    requestsPerSecond: numberFrom(rpsMatch?.[1]),
    checksPassPercent: numberFrom(checksMatch?.[1]),
    checksPassed: numberFrom(checksMatch?.[2]),
    checksFailed: numberFrom(checksMatch?.[3]),
    errorRatePercent: numberFrom(errorRateMatch?.[1]),
    avgLatencyMs: parseDurationToMs(durationTokens.get("avg") ?? ""),
    p95LatencyMs: parseDurationToMs(durationTokens.get("p(95)") ?? ""),
    maxLatencyMs: parseDurationToMs(durationTokens.get("max") ?? ""),
  };

  const hasAnyMetric = Object.values(parsed).some((v) => typeof v === "number" && Number.isFinite(v));
  return hasAnyMetric ? parsed : null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost text-xs inline-flex items-center gap-1"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      <Copy size={14} />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function LoadTest() {
  const activeEnvId = useActiveEnv((s) => s.selectedId);
  const [collectionId, setCollectionId] = useState("");
  const [environmentId, setEnvironmentId] = useState<string>(activeEnvId ?? "");
  const [vus, setVus] = useState(50);
  const [rampUpSeconds, setRampUpSeconds] = useState(30);
  const [durationSeconds, setDurationSeconds] = useState(120);
  const [p95Ms, setP95Ms] = useState(500);
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<LoadTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!environmentId && activeEnvId) setEnvironmentId(activeEnvId);
  }, [activeEnvId, environmentId]);

  const collections = useQuery<Collection[]>({
    queryKey: ["loadtest-collections"],
    queryFn: async () => (await api.get("/collections")).data,
  });

  const environments = useQuery<Environment[]>({
    queryKey: ["loadtest-environments"],
    queryFn: async () => (await api.get("/environments")).data,
  });

  const selectedCollection = useMemo(
    () => collections.data?.find((c) => c.id === collectionId),
    [collections.data, collectionId]
  );

  const scriptQ = useQuery({
    queryKey: ["loadtest-script", collectionId, environmentId, vus, rampUpSeconds, durationSeconds, p95Ms],
    queryFn: async () => {
      const { data } = await api.get<string>(`/loadtest/${collectionId}/script`, {
        params: {
          tool: "k6",
          environment_id: environmentId || undefined,
          vus,
          ramp_up_seconds: rampUpSeconds,
          duration_seconds: durationSeconds,
          p95_ms: p95Ms,
        },
        responseType: "text",
      });
      return data;
    },
    enabled: !!collectionId,
  });

  useEffect(() => {
    if (scriptQ.data) setScriptText(scriptQ.data);
  }, [scriptQ.data]);

  // axios timeout must exceed ramp-up + duration + 30s teardown + 60s padding
  const runTimeoutMs = (rampUpSeconds + durationSeconds + 90) * 1000;

  const runMut = useMutation({
    mutationFn: async () =>
      (await api.post<LoadTestResponse>(`/loadtest/${collectionId}/run`, {
        environment_id: environmentId || null,
        vus,
        ramp_up_seconds: rampUpSeconds,
        duration_seconds: durationSeconds,
        p95_ms: p95Ms,
      }, { timeout: runTimeoutMs })).data,
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      setScriptText(data.script);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to run k6");
    },
  });

  function downloadScript() {
    if (!scriptText) return;
    const blob = new Blob([scriptText], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `k6-${selectedCollection?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "loadtest"}.js`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const runCommand = useMemo(() => {
    const filename = `k6-${selectedCollection?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "loadtest"}.js`;
    return `k6 run ${filename}`;
  }, [selectedCollection?.name]);

  const parsedMetrics = useMemo(() => parseK6Stdout(result?.stdout ?? ""), [result?.stdout]);

  const latencyBars = useMemo(() => {
    if (!parsedMetrics) return [];
    return [
      { label: "Avg latency", value: parsedMetrics.avgLatencyMs ?? 0 },
      { label: "P95 latency", value: parsedMetrics.p95LatencyMs ?? 0 },
      { label: "Max latency", value: parsedMetrics.maxLatencyMs ?? 0 },
    ].filter((item) => item.value > 0);
  }, [parsedMetrics]);

  const outcomePie = useMemo(() => {
    if (!parsedMetrics) return [] as { name: string; value: number }[];
    if ((parsedMetrics.checksPassed ?? 0) > 0 || (parsedMetrics.checksFailed ?? 0) > 0) {
      return [
        { name: "Passed", value: parsedMetrics.checksPassed ?? 0 },
        { name: "Failed", value: parsedMetrics.checksFailed ?? 0 },
      ].filter((item) => item.value > 0);
    }
    const total = parsedMetrics.totalRequests ?? 0;
    const errorPct = parsedMetrics.errorRatePercent ?? 0;
    if (total > 0 && errorPct >= 0) {
      const failed = Math.round(total * (errorPct / 100));
      const passed = Math.max(total - failed, 0);
      return [
        { name: "Passed", value: passed },
        { name: "Failed", value: failed },
      ].filter((item) => item.value > 0);
    }
    return [];
  }, [parsedMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="h-title flex items-center gap-2">
            <AlertTriangle className="text-violet-500" /> Load Testing
          </h1>
          <p className="text-sm text-slate-500">
            Generate and execute k6 test cases from a collection.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="badge-brand">k6</span>
          <span>Uses selected environment for {`{{baseUrl}}`} substitution</span>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Collection</label>
            <select className="input mt-1" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              <option value="">— Select a collection —</option>
              {collections.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Environment</label>
            <select className="input mt-1" value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
              <option value="">— None —</option>
              {environments.data?.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Virtual users</label>
            <input className="input mt-1" type="number" min={1} value={vus} onChange={(e) => setVus(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Ramp-up (seconds)</label>
            <input className="input mt-1" type="number" min={0} value={rampUpSeconds} onChange={(e) => setRampUpSeconds(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Duration (seconds)</label>
            <input className="input mt-1" type="number" min={1} value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-slate-500">P95 threshold (ms)</label>
            <input className="input mt-1" type="number" min={1} value={p95Ms} onChange={(e) => setP95Ms(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => runMut.mutate()} disabled={!collectionId || runMut.isPending}>
            <Play size={14} /> {runMut.isPending ? "Running…" : "Run k6"}
          </button>
          <button className="btn-ghost inline-flex items-center gap-1 text-xs" onClick={() => scriptQ.refetch()} disabled={!collectionId || scriptQ.isFetching}>
            <RefreshCw size={12} className={scriptQ.isFetching ? "animate-spin" : ""} /> Refresh script
          </button>
          <button className="btn-ghost inline-flex items-center gap-1 text-xs" onClick={downloadScript} disabled={!scriptText}>
            <Download size={12} /> Download script
          </button>
          <CopyButton text={runCommand} />
        </div>

        {(error || result) && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {result?.status === "passed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {result?.status || "Error"}
                </span>
                {typeof result?.elapsed_ms === "number" && (
                  <span className="text-xs text-slate-500">{result.elapsed_ms} ms</span>
                )}
              </div>
              {typeof result?.exit_code === "number" && (
                <span className="text-[11px] text-slate-400 font-mono">exit {result.exit_code}</span>
              )}
            </div>
            <div className="p-3 space-y-2 text-xs">
              {error && <div className="text-rose-600">{error}</div>}
              {result?.stderr && <pre className="font-mono bg-slate-950 text-rose-300 p-3 rounded overflow-auto max-h-72">{result.stderr}</pre>}
              {result?.stdout && <pre className="font-mono bg-slate-950 text-emerald-300 p-3 rounded overflow-auto max-h-72">{result.stdout}</pre>}
            </div>
          </div>
        )}
      </div>

      {!!result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Total requests</div>
              <div className="text-lg font-semibold">{parsedMetrics?.totalRequests ?? "—"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Requests/sec</div>
              <div className="text-lg font-semibold">{parsedMetrics?.requestsPerSecond?.toFixed(2) ?? "—"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">P95 latency</div>
              <div className="text-lg font-semibold">{parsedMetrics?.p95LatencyMs ? `${Math.round(parsedMetrics.p95LatencyMs)} ms` : "—"}</div>
            </div>
            <div className="card p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Error rate</div>
              <div className="text-lg font-semibold">{parsedMetrics?.errorRatePercent != null ? `${parsedMetrics.errorRatePercent.toFixed(2)}%` : "—"}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Load Test Report - Latency" subtitle="Average, P95, and max response time (ms)">
              {latencyBars.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No latency metrics found in this run output.
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={latencyBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" />
                    <YAxis unit="ms" />
                    <Tooltip contentStyle={tooltipStyle()} formatter={(v: any) => [`${Number(v).toFixed(2)} ms`, "Value"]} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {latencyBars.map((entry, idx) => (
                        <Cell key={entry.label} fill={PALETTE[idx % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Load Test Report - Success vs Failure" subtitle="Distribution from checks or request error rate">
              {outcomePie.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No pass/fail distribution found in this run output.
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle()} formatter={(v: any, n: any) => [v, n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Pie
                      data={outcomePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={92}
                      paddingAngle={2}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {outcomePie.map((entry, idx) => (
                        <Cell key={entry.name} fill={idx === 0 ? "#10b981" : "#ef4444"} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
            <div className="text-sm font-medium">Generated k6 script</div>
            <div className="flex items-center gap-2">
              <CopyButton text={scriptText || ""} />
              <button className="btn-ghost text-xs" onClick={downloadScript} disabled={!scriptText}>
                Download
              </button>
            </div>
          </div>
          <pre className="text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-[65vh] whitespace-pre-wrap">
{scriptQ.isLoading ? "Loading script…" : scriptText || "Select a collection to generate a script."}
          </pre>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-2 text-xs text-slate-500">
            <div className="font-semibold text-slate-700 dark:text-slate-200">Run command</div>
            <code className="block font-mono bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded p-2 break-all">
              {runCommand}
            </code>
            <p>
              The backend resolves <code>{`{{baseUrl}}`}</code> from the selected environment before generating the script.
            </p>
          </div>

          <div className="card p-4 space-y-2 text-xs text-slate-500">
            <div className="font-semibold text-slate-700 dark:text-slate-200">Selected collection</div>
            <div>{selectedCollection?.name || "No collection selected"}</div>
            {selectedCollection?.description && <p>{selectedCollection.description}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}