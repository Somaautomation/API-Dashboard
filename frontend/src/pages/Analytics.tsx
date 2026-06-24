import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Gauge, CheckCircle2, XCircle, Timer, RefreshCw, Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
  LineChart, Line,
  AreaChart, Area,
} from "recharts";

import { api } from "@/lib/api";
import ChartCard from "@/components/charts/ChartCard";
import KpiCard from "@/components/charts/KpiCard";
import { PALETTE, STATUS_COLORS, tooltipStyle } from "@/components/charts/palette";

/* ---------- Types matching backend /analytics/* responses ---------- */
interface ExecutionsResp {
  kpis: {
    total_apis: number;
    total_executions: number;
    total_assertions: number;
    pass_rate: number;
    fail_rate: number;
    avg_response_ms: number;
  };
  bars: { name: string; count: number }[];
}
interface FailuresResp { total: number; slices: { name: string; value: number; percent: number }[] }
interface TrendsResp  { days: number; series: { date: string; runs: number; passed: number; failed: number; avg_ms: number }[] }
interface EnvResp     { environments: { name: string; kind: string; runs: number; passed: number; failed: number; success_pct: number; failure_pct: number; avg_response_ms: number }[] }
interface TopFailing  { items: { endpoint: string; failure_count: number; last_failed: string | null; avg_response_ms: number }[] }
interface LoadResp    { series: { t: number; vus: number; rps: number; error_rate: number; avg_latency_ms: number }[] }

/* ---------- CSV helper ---------- */
function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
function downloadCsv(name: string, rows: Record<string, any>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Page ---------- */
export default function Analytics() {
  const [days, setDays] = useState(14);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const interval = autoRefresh ? 15_000 : false;

  const execQ   = useQuery({ queryKey: ["a-exec"],   queryFn: async () => (await api.get<ExecutionsResp>("/analytics/executions")).data, refetchInterval: interval });
  const failQ   = useQuery({ queryKey: ["a-fail"],   queryFn: async () => (await api.get<FailuresResp>("/analytics/failures")).data,    refetchInterval: interval });
  const trendQ  = useQuery({ queryKey: ["a-trend", days], queryFn: async () => (await api.get<TrendsResp>(`/analytics/trends?days=${days}`)).data, refetchInterval: interval });
  const envQ    = useQuery({ queryKey: ["a-env"],    queryFn: async () => (await api.get<EnvResp>("/analytics/environments")).data,    refetchInterval: interval });
  const topQ    = useQuery({ queryKey: ["a-top"],    queryFn: async () => (await api.get<TopFailing>("/analytics/top-failing?limit=10")).data, refetchInterval: interval });
  const loadQ   = useQuery({ queryKey: ["a-load"],   queryFn: async () => (await api.get<LoadResp>("/analytics/loadtest")).data,        refetchInterval: interval });

  const isLoading = execQ.isLoading || failQ.isLoading || trendQ.isLoading || envQ.isLoading;
  const refreshAll = () => { execQ.refetch(); failQ.refetch(); trendQ.refetch(); envQ.refetch(); topQ.refetch(); loadQ.refetch(); };

  const kpis = execQ.data?.kpis;
  const statusBars = useMemo(() => execQ.data?.bars ?? [], [execQ.data]);

  return (
    <div className="space-y-6">
      {/* ----- Header / Filters ----- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">Analytics</h1>
          <p className="text-sm text-slate-500">Execution insights, trends &amp; environment stability</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[11px] text-slate-500 block">Date range</label>
            <select className="input mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <label className="text-xs flex items-center gap-1 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input type="checkbox" className="accent-sky-600" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto refresh
          </label>
          <button className="btn-ghost border border-slate-200 dark:border-slate-700" onClick={refreshAll} title="Refresh now">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </button>
        </div>
      </div>

      {/* ----- KPI cards ----- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total APIs"        value={kpis?.total_apis ?? 0}        icon={Activity}     accent="sky"     help="Across all collections" />
        <KpiCard label="Total Executions"  value={kpis?.total_executions ?? 0}  icon={Gauge}        accent="violet"  help="Runs recorded" />
        <KpiCard label="Assertions"        value={kpis?.total_assertions ?? 0}  icon={CheckCircle2} accent="slate" />
        <KpiCard label="Pass Rate"         value={kpis?.pass_rate ?? 0}         icon={CheckCircle2} accent="emerald" suffix="%" />
        <KpiCard label="Failure Rate"      value={kpis?.fail_rate ?? 0}         icon={XCircle}      accent="rose"    suffix="%" />
        <KpiCard label="Avg Response"      value={kpis?.avg_response_ms ?? 0}   icon={Timer}        accent="amber"   suffix="ms" />
      </div>

      {/* ----- Row 1: Status bar + Failure pie ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="API Execution Status"
          subtitle="Passed / Failed / Skipped (all assertions)"
          right={
            <button className="btn-ghost text-xs" onClick={() => downloadCsv("status.csv", statusBars)}>
              <Download size={12} className="mr-1" /> CSV
            </button>
          }
        >
          {isLoading && !execQ.data ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer>
              <BarChart data={statusBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={700}>
                  {statusBars.map((s) => (
                    <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? PALETTE[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Failure Analysis" subtitle="Distribution by category">
          {failQ.isLoading ? (
            <Skeleton />
          ) : (failQ.data?.total ?? 0) === 0 ? (
            <Empty msg="No failures recorded yet 🎉" />
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Tooltip contentStyle={tooltipStyle()} formatter={(v: any, _n, p: any) => [`${v} (${p?.payload?.percent}%)`, p?.payload?.name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie
                  data={failQ.data!.slices.filter((s) => s.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={95}
                  paddingAngle={2}
                  label={(e: any) => `${e.percent}%`}
                  animationDuration={700}
                >
                  {failQ.data!.slices.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ----- Row 2: Trend line + Environment bars ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Daily Execution Trend"
          subtitle={`Last ${days} days`}
          right={
            <button className="btn-ghost text-xs" onClick={() => downloadCsv("trend.csv", trendQ.data?.series ?? [])}>
              <Download size={12} className="mr-1" /> CSV
            </button>
          }
        >
          {trendQ.isLoading ? <Skeleton /> : (trendQ.data?.series.length ?? 0) === 0 ? <Empty msg="No runs in this period" /> : (
            <ResponsiveContainer>
              <LineChart data={trendQ.data!.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                <YAxis />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} animationDuration={700} />
                <Line type="monotone" dataKey="runs"   stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Environment Stability" subtitle="Success vs Failure % + avg response">
          {envQ.isLoading ? <Skeleton /> : (envQ.data?.environments.length ?? 0) === 0 ? <Empty msg="No environments configured" /> : (
            <ResponsiveContainer>
              <BarChart data={envQ.data!.environments}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" unit="%" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" unit="ms" />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left"  dataKey="success_pct" name="Success %" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left"  dataKey="failure_pct" name="Failure %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avg_response_ms" name="Avg ms" stroke="#f59e0b" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ----- Row 3: Top failing APIs (chart + table) ----- */}
      <ChartCard
        title="Top Failing APIs"
        subtitle="By total failed assertions"
        right={
          <button className="btn-ghost text-xs" onClick={() => downloadCsv("top-failing.csv", topQ.data?.items ?? [])}>
            <Download size={12} className="mr-1" /> CSV
          </button>
        }
      >
        {topQ.isLoading ? <Skeleton /> : (topQ.data?.items.length ?? 0) === 0 ? <Empty msg="No failing endpoints" /> : (
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 h-full">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={topQ.data!.items} layout="vertical" margin={{ left: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="endpoint" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle()} />
                  <Bar dataKey="failure_count" name="Failures" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
                  <tr>
                    <th className="text-left py-2 pr-2">Endpoint</th>
                    <th className="text-right py-2 pr-2">Fails</th>
                    <th className="text-right py-2 pr-2">Avg ms</th>
                    <th className="text-left py-2">Last failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topQ.data!.items.map((it) => (
                    <tr key={it.endpoint}>
                      <td className="py-1.5 pr-2 font-mono truncate max-w-[180px]">{it.endpoint}</td>
                      <td className="py-1.5 pr-2 text-right text-red-600 font-medium">{it.failure_count}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-500">{it.avg_response_ms}</td>
                      <td className="py-1.5 text-slate-500">{it.last_failed ? new Date(it.last_failed).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ChartCard>

      {/* ----- Row 4: Load testing ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Load Test — Throughput &amp; Latency" subtitle="Requests/s + avg latency over time (sample)">
          {loadQ.isLoading ? <Skeleton /> : (
            <ResponsiveContainer>
              <AreaChart data={loadQ.data!.series}>
                <defs>
                  <linearGradient id="rps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" unit="s" />
                <YAxis />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="rps" name="RPS" stroke="#0ea5e9" fill="url(#rps)" strokeWidth={2} />
                <Area type="monotone" dataKey="avg_latency_ms" name="Avg latency (ms)" stroke="#f59e0b" fill="url(#lat)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Load Test — VUs &amp; Error rate" subtitle="Virtual users vs error %">
          {loadQ.isLoading ? <Skeleton /> : (
            <ResponsiveContainer>
              <BarChart data={loadQ.data!.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" unit="s" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" unit="%" />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="vus" name="VUs" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="error_rate" name="Error %" stroke="#ef4444" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <p className="text-[11px] text-slate-500">
        Tip: scheduled PDF exports are available via <code>GET /api/v1/reports/runs/&lt;id&gt;/pdf</code>.
        Use the CSV buttons above for ad-hoc spreadsheet exports.
      </p>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function Skeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/50" />
  );
}
function Empty({ msg }: { msg: string }) {
  return (
    <div className="h-full w-full grid place-items-center text-sm text-slate-500">{msg}</div>
  );
}
