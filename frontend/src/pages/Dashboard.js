import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from "recharts";
export default function Dashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ["overview"],
        queryFn: async () => (await api.get("/reports/overview")).data,
    });
    if (isLoading || !data)
        return _jsx("div", { className: "text-sm text-slate-500", children: "Loading metrics\u2026" });
    const stats = [
        { label: "Total runs (30d)", value: data.total_runs, gradient: "bg-gradient-sky" },
        { label: "Pass rate", value: `${(data.pass_rate * 100).toFixed(1)}%`, gradient: "bg-gradient-mint" },
        { label: "Passed", value: data.passed, gradient: "bg-gradient-mint" },
        { label: "Failed", value: data.failed, gradient: "bg-gradient-sunset" },
        { label: "Avg duration", value: `${Math.round(data.avg_duration_ms)} ms`, gradient: "bg-gradient-brand" },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "h-title", children: "ZPE CLOUD Platform overview" }), _jsx("p", { className: "text-sm text-slate-500", children: "Last 30 days of execution telemetry" })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-4", children: stats.map((s) => (_jsxs("div", { className: `card-gradient ${s.gradient}`, children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-white/80", children: s.label }), _jsx("div", { className: "text-3xl font-bold mt-1", children: s.value })] }, s.label))) }), _jsxs("div", { className: "card p-4", children: [_jsx("div", { className: "text-sm font-semibold mb-2 bg-gradient-brand bg-clip-text text-transparent", children: "Pass / Fail trend" }), _jsx("div", { className: "h-72", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: data.trend, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e2e8f0" }), _jsx(XAxis, { dataKey: "date", tickFormatter: (d) => d.slice(5, 10) }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "passed", stroke: "#10b981", strokeWidth: 2.5, dot: { r: 3 } }), _jsx(Line, { type: "monotone", dataKey: "failed", stroke: "#f43f5e", strokeWidth: 2.5, dot: { r: 3 } })] }) }) })] })] }));
}
