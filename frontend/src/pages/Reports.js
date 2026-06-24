import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, } from "recharts";
import { FileText, FileSpreadsheet, RefreshCw, Download } from "lucide-react";
import { api } from "@/lib/api";
function statusBadge(s) {
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
function formatDuration(ms) {
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    if (ms < 60_000)
        return `${(ms / 1000).toFixed(2)} s`;
    return `${(ms / 60_000).toFixed(2)} m`;
}
async function downloadRunReport(runId, format) {
    const backendPath = format === "xlsx" ? "excel" : format;
    const res = await api.get(`/reports/runs/${runId}/${backendPath}`, {
        responseType: "blob",
    });
    const blob = new Blob([res.data], {
        type: format === "pdf"
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
function KpiCard({ label, value, hint, cls = "", }) {
    return (_jsxs("div", { className: "card p-4", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: label }), _jsx("div", { className: `text-2xl font-bold mt-1 ${cls}`, children: value }), hint && _jsx("div", { className: "text-[11px] text-slate-500 mt-1", children: hint })] }));
}
export default function Reports() {
    const [statusFilter, setStatusFilter] = useState("all");
    const [busyId, setBusyId] = useState(null);
    const [err, setErr] = useState(null);
    const overview = useQuery({
        queryKey: ["reports-overview"],
        queryFn: async () => (await api.get("/reports/overview")).data,
    });
    const runs = useQuery({
        queryKey: ["reports-runs"],
        queryFn: async () => (await api.get("/runs", { params: { limit: 50 } })).data,
        refetchInterval: 10_000,
    });
    const filtered = useMemo(() => {
        const list = runs.data ?? [];
        if (statusFilter === "all")
            return list;
        return list.filter((r) => r.status === statusFilter);
    }, [runs.data, statusFilter]);
    const download = async (runId, fmt) => {
        setErr(null);
        setBusyId(`${runId}:${fmt}`);
        try {
            await downloadRunReport(runId, fmt);
        }
        catch (e) {
            setErr(e?.response?.status
                ? `Download failed (HTTP ${e.response.status})`
                : e?.message || "Download failed");
        }
        finally {
            setBusyId(null);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Reports" }), _jsxs("p", { className: "text-sm text-slate-500", children: ["Aggregate metrics + per-run PDF / Excel exports. Window:", " ", overview.data?.window_days ?? 30, " days."] })] }), _jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", onClick: () => {
                            overview.refetch();
                            runs.refetch();
                        }, children: [_jsx(RefreshCw, { size: 12 }), " Refresh"] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-3", children: [_jsx(KpiCard, { label: "Total runs", value: overview.data?.total_runs ?? "—", hint: `last ${overview.data?.window_days ?? 30}d` }), _jsx(KpiCard, { label: "Passed", value: overview.data?.passed ?? "—", cls: "text-emerald-600 dark:text-emerald-400" }), _jsx(KpiCard, { label: "Failed", value: overview.data?.failed ?? "—", cls: "text-rose-600 dark:text-rose-400" }), _jsx(KpiCard, { label: "Pass rate", value: overview.data ? `${(overview.data.pass_rate * 100).toFixed(1)}%` : "—" }), _jsx(KpiCard, { label: "Avg duration", value: overview.data ? formatDuration(overview.data.avg_duration_ms) : "—" })] }), _jsxs("div", { className: "card p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "text-sm font-medium", children: "Pass / Fail trend" }), _jsxs("div", { className: "text-[11px] text-slate-400", children: ["daily aggregates \u00B7 ", overview.data?.trend?.length ?? 0, " points"] })] }), _jsx("div", { className: "h-64", children: overview.isLoading ? (_jsx("div", { className: "h-full flex items-center justify-center text-xs text-slate-400", children: "Loading\u2026" })) : (overview.data?.trend?.length ?? 0) === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center text-xs text-slate-400", children: "No data in the selected window \u2014 trigger a run to populate." })) : (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: (overview.data?.trend ?? []).map((p) => ({
                                    ...p,
                                    date: new Date(p.date).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    }),
                                })), margin: { top: 8, right: 16, left: 0, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", opacity: 0.2 }), _jsx(XAxis, { dataKey: "date", fontSize: 11 }), _jsx(YAxis, { fontSize: 11, allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Legend, { wrapperStyle: { fontSize: 11 } }), _jsx(Line, { type: "monotone", dataKey: "passed", stroke: "#10b981", strokeWidth: 2, dot: false }), _jsx(Line, { type: "monotone", dataKey: "failed", stroke: "#ef4444", strokeWidth: 2, dot: false })] }) })) })] }), _jsxs("div", { className: "card p-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800", children: [_jsx("div", { className: "text-sm font-medium", children: "Per-run exports" }), _jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("label", { className: "text-slate-500", children: "Filter" }), _jsxs("select", { className: "input h-7 text-xs py-0", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "passed", children: "Passed" }), _jsx("option", { value: "failed", children: "Failed" }), _jsx("option", { value: "running", children: "Running" })] })] })] }), err && (_jsx("div", { className: "px-4 py-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20", children: err })), _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800/40 text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2", children: "Run ID" }), _jsx("th", { className: "text-left px-4 py-2", children: "Status" }), _jsx("th", { className: "text-left px-4 py-2", children: "Pass / Total" }), _jsx("th", { className: "text-left px-4 py-2", children: "Duration" }), _jsx("th", { className: "text-left px-4 py-2", children: "When" }), _jsx("th", { className: "text-right px-4 py-2", children: "Export" })] }) }), _jsxs("tbody", { children: [filtered.map((r) => (_jsxs("tr", { className: "border-t border-slate-100 dark:border-slate-800", children: [_jsx("td", { className: "px-4 py-2 font-mono text-slate-400", title: r.id, children: r.id.slice(0, 8) }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`, children: r.status }) }), _jsxs("td", { className: "px-4 py-2", children: [r.passed, "/", r.total] }), _jsx("td", { className: "px-4 py-2", children: formatDuration(r.duration_ms) }), _jsx("td", { className: "px-4 py-2 text-slate-500", children: new Date(r.created_at).toLocaleString() }), _jsx("td", { className: "px-4 py-2 text-right", children: _jsxs("div", { className: "inline-flex gap-1", children: [_jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", disabled: busyId === `${r.id}:pdf`, onClick: () => download(r.id, "pdf"), title: "Download PDF", children: [busyId === `${r.id}:pdf` ? (_jsx(Download, { size: 12, className: "animate-pulse" })) : (_jsx(FileText, { size: 12, className: "text-rose-500" })), "PDF"] }), _jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", disabled: busyId === `${r.id}:xlsx`, onClick: () => download(r.id, "xlsx"), title: "Download Excel", children: [busyId === `${r.id}:xlsx` ? (_jsx(Download, { size: 12, className: "animate-pulse" })) : (_jsx(FileSpreadsheet, { size: 12, className: "text-emerald-600" })), "XLSX"] })] }) })] }, r.id))), filtered.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-8 text-center text-slate-400", children: runs.isLoading
                                                ? "Loading runs…"
                                                : statusFilter === "all"
                                                    ? "No runs yet — trigger one from Collections or Automation."
                                                    : `No ${statusFilter} runs in the current window.` }) }))] })] })] })] }));
}
