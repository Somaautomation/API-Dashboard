import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { FileText, FileSpreadsheet, RefreshCw, Download } from "lucide-react";
import { api } from "@/lib/api";

interface OverviewTrendPoint {
  date: string;
  passed: number;
  failed: number;
}
interface Overview {
  window_days: number;
  total_runs: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_duration_ms: number;
  trend: OverviewTrendPoint[];
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

function statusBadge(s: string) {
  switch (s) {
    case "passed":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "running":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(2)} m`;
}

async function downloadRunReport(runId: string, format: "pdf" | "xlsx") {
  const backendPath = format === "xlsx" ? "excel" : format;
  const res = await api.get(`/reports/runs/${runId}/${backendPath}`, {
    responseType: "blob",
  });
  const blob = new Blob([res.data], {
    type:
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `run-${runId.slice(0, 8)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function KpiCard({
  label,
  value,
  hint,
  cls = "",
}: {
  label: string;
  value: string | number;
  hint?: string;
  cls?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function Reports() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const overview = useQuery<Overview>({
    queryKey: ["reports-overview"],
    queryFn: async () => (await api.get("/reports/overview")).data,
  });

  const runs = useQuery<RunOut[]>({
    queryKey: ["reports-runs"],
    queryFn: async () => (await api.get("/runs", { params: { limit: 50 } })).data,
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => {
    const list = runs.data ?? [];
    if (statusFilter === "all") return list;
    return list.filter((r) => r.status === statusFilter);
  }, [runs.data, statusFilter]);

  const download = async (runId: string, fmt: "pdf" | "xlsx") => {
    setErr(null);
    setBusyId(`${runId}:${fmt}`);
    try {
      await downloadRunReport(runId, fmt);
    } catch (e: any) {
      setErr(
        e?.response?.status
          ? `Download failed (HTTP ${e.response.status})`
          : e?.message || "Download failed"
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-slate-500">
            Aggregate metrics + per-run PDF / Excel exports. Window:{" "}
            {overview.data?.window_days ?? 30} days.
          </p>
        </div>
        <button
          className="btn-ghost text-xs flex items-center gap-1"
          onClick={() => {
            overview.refetch();
            runs.refetch();
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Total runs"
          value={overview.data?.total_runs ?? "—"}
          hint={`last ${overview.data?.window_days ?? 30}d`}
        />
        <KpiCard
          label="Passed"
          value={overview.data?.passed ?? "—"}
          cls="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label="Failed"
          value={overview.data?.failed ?? "—"}
          cls="text-rose-600 dark:text-rose-400"
        />
        <KpiCard
          label="Pass rate"
          value={
            overview.data ? `${(overview.data.pass_rate * 100).toFixed(1)}%` : "—"
          }
        />
        <KpiCard
          label="Avg duration"
          value={overview.data ? formatDuration(overview.data.avg_duration_ms) : "—"}
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Pass / Fail trend</div>
          <div className="text-[11px] text-slate-400">
            daily aggregates · {overview.data?.trend?.length ?? 0} points
          </div>
        </div>
        <div className="h-64">
          {overview.isLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Loading…
            </div>
          ) : (overview.data?.trend?.length ?? 0) === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No data in the selected window — trigger a run to populate.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(overview.data?.trend ?? []).map((p) => ({
                  ...p,
                  date: new Date(p.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  }),
                }))}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="passed"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-medium">Per-run exports</div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500">Filter</label>
            <select
              className="input h-7 text-xs py-0"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>
          </div>
        </div>
        {err && (
          <div className="px-4 py-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20">
            {err}
          </div>
        )}
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Run ID</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Pass / Total</th>
              <th className="text-left px-4 py-2">Duration</th>
              <th className="text-left px-4 py-2">When</th>
              <th className="text-right px-4 py-2">Export</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 font-mono text-slate-400" title={r.id}>
                  {r.id.slice(0, 8)}
                </td>
                <td className="px-4 py-2">
                  <span className={`badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {r.passed}/{r.total}
                </td>
                <td className="px-4 py-2">{formatDuration(r.duration_ms)}</td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      className="btn-ghost text-xs flex items-center gap-1"
                      disabled={busyId === `${r.id}:pdf`}
                      onClick={() => download(r.id, "pdf")}
                      title="Download PDF"
                    >
                      {busyId === `${r.id}:pdf` ? (
                        <Download size={12} className="animate-pulse" />
                      ) : (
                        <FileText size={12} className="text-rose-500" />
                      )}
                      PDF
                    </button>
                    <button
                      className="btn-ghost text-xs flex items-center gap-1"
                      disabled={busyId === `${r.id}:xlsx`}
                      onClick={() => download(r.id, "xlsx")}
                      title="Download Excel"
                    >
                      {busyId === `${r.id}:xlsx` ? (
                        <Download size={12} className="animate-pulse" />
                      ) : (
                        <FileSpreadsheet size={12} className="text-emerald-600" />
                      )}
                      XLSX
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {runs.isLoading
                    ? "Loading runs…"
                    : statusFilter === "all"
                    ? "No runs yet — trigger one from Collections or Automation."
                    : `No ${statusFilter} runs in the current window.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
