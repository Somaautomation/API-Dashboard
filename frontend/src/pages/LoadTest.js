import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play, Copy, Download, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, } from "recharts";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";
import ChartCard from "@/components/charts/ChartCard";
import { PALETTE, tooltipStyle } from "@/components/charts/palette";
function parseDurationToMs(input) {
    const raw = input.trim();
    const match = raw.match(/^([0-9]*\.?[0-9]+)\s*(us|µs|ms|s|m)$/i);
    if (!match)
        return null;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(value))
        return null;
    if (unit === "us" || unit === "µs")
        return value / 1000;
    if (unit === "ms")
        return value;
    if (unit === "s")
        return value * 1000;
    if (unit === "m")
        return value * 60 * 1000;
    return null;
}
function parseK6Stdout(stdout) {
    if (!stdout.trim())
        return null;
    const numberFrom = (value) => {
        if (!value)
            return null;
        const n = Number(value.replaceAll(",", ""));
        return Number.isFinite(n) ? n : null;
    };
    const totalReqMatch = stdout.match(/^\s*http_reqs\.*:\s*([\d,]+)/m);
    const rpsMatch = stdout.match(/^\s*http_reqs\.*:\s*[\d,]+\s+([0-9]*\.?[0-9]+)\/s/m);
    const checksMatch = stdout.match(/^\s*checks\.*:\s*([0-9]*\.?[0-9]+)%\s*✓\s*([\d,]+)\s*✗\s*([\d,]+)/m);
    const errorRateMatch = stdout.match(/^\s*http_req_failed\.*:\s*([0-9]*\.?[0-9]+)%/m);
    const durationLine = stdout.match(/^\s*http_req_duration\.*:.*$/m)?.[0] ?? "";
    const durationTokens = new Map();
    for (const token of durationLine.matchAll(/([a-zA-Z0-9()]+)=([0-9]*\.?[0-9]+(?:us|µs|ms|s|m))/g)) {
        durationTokens.set(token[1], token[2]);
    }
    const parsed = {
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
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return (_jsxs("button", { type: "button", className: "btn-ghost text-xs inline-flex items-center gap-1", onClick: async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        }, children: [_jsx(Copy, { size: 14 }), copied ? "Copied" : "Copy"] }));
}
export default function LoadTest() {
    const activeEnvId = useActiveEnv((s) => s.selectedId);
    const [collectionId, setCollectionId] = useState("");
    const [environmentId, setEnvironmentId] = useState(activeEnvId ?? "");
    const [vus, setVus] = useState(50);
    const [rampUpSeconds, setRampUpSeconds] = useState(30);
    const [durationSeconds, setDurationSeconds] = useState(120);
    const [p95Ms, setP95Ms] = useState(500);
    const [scriptText, setScriptText] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!environmentId && activeEnvId)
            setEnvironmentId(activeEnvId);
    }, [activeEnvId, environmentId]);
    const collections = useQuery({
        queryKey: ["loadtest-collections"],
        queryFn: async () => (await api.get("/collections")).data,
    });
    const environments = useQuery({
        queryKey: ["loadtest-environments"],
        queryFn: async () => (await api.get("/environments")).data,
    });
    const selectedCollection = useMemo(() => collections.data?.find((c) => c.id === collectionId), [collections.data, collectionId]);
    const scriptQ = useQuery({
        queryKey: ["loadtest-script", collectionId, environmentId, vus, rampUpSeconds, durationSeconds, p95Ms],
        queryFn: async () => {
            const { data } = await api.get(`/loadtest/${collectionId}/script`, {
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
        if (scriptQ.data)
            setScriptText(scriptQ.data);
    }, [scriptQ.data]);
    // axios timeout must exceed ramp-up + duration + 30s teardown + 60s padding
    const runTimeoutMs = (rampUpSeconds + durationSeconds + 90) * 1000;
    const runMut = useMutation({
        mutationFn: async () => (await api.post(`/loadtest/${collectionId}/run`, {
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
        onError: (e) => {
            setError(e?.response?.data?.detail ?? e?.message ?? "Failed to run k6");
        },
    });
    function downloadScript() {
        if (!scriptText)
            return;
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
        if (!parsedMetrics)
            return [];
        return [
            { label: "Avg latency", value: parsedMetrics.avgLatencyMs ?? 0 },
            { label: "P95 latency", value: parsedMetrics.p95LatencyMs ?? 0 },
            { label: "Max latency", value: parsedMetrics.maxLatencyMs ?? 0 },
        ].filter((item) => item.value > 0);
    }, [parsedMetrics]);
    const outcomePie = useMemo(() => {
        if (!parsedMetrics)
            return [];
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsxs("h1", { className: "h-title flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "text-violet-500" }), " Load Testing"] }), _jsx("p", { className: "text-sm text-slate-500", children: "Generate and execute k6 test cases from a collection." })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { className: "badge-brand", children: "k6" }), _jsxs("span", { children: ["Uses selected environment for ", `{{baseUrl}}`, " substitution"] })] })] }), _jsxs("div", { className: "card p-4 space-y-4", children: [_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Collection" }), _jsxs("select", { className: "input mt-1", value: collectionId, onChange: (e) => setCollectionId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Select a collection \u2014" }), collections.data?.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Environment" }), _jsxs("select", { className: "input mt-1", value: environmentId, onChange: (e) => setEnvironmentId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), environments.data?.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Virtual users" }), _jsx("input", { className: "input mt-1", type: "number", min: 1, value: vus, onChange: (e) => setVus(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Ramp-up (seconds)" }), _jsx("input", { className: "input mt-1", type: "number", min: 0, value: rampUpSeconds, onChange: (e) => setRampUpSeconds(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Duration (seconds)" }), _jsx("input", { className: "input mt-1", type: "number", min: 1, value: durationSeconds, onChange: (e) => setDurationSeconds(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "P95 threshold (ms)" }), _jsx("input", { className: "input mt-1", type: "number", min: 1, value: p95Ms, onChange: (e) => setP95Ms(Number(e.target.value)) })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { className: "btn-primary inline-flex items-center gap-2", onClick: () => runMut.mutate(), disabled: !collectionId || runMut.isPending, children: [_jsx(Play, { size: 14 }), " ", runMut.isPending ? "Running…" : "Run k6"] }), _jsxs("button", { className: "btn-ghost inline-flex items-center gap-1 text-xs", onClick: () => scriptQ.refetch(), disabled: !collectionId || scriptQ.isFetching, children: [_jsx(RefreshCw, { size: 12, className: scriptQ.isFetching ? "animate-spin" : "" }), " Refresh script"] }), _jsxs("button", { className: "btn-ghost inline-flex items-center gap-1 text-xs", onClick: downloadScript, disabled: !scriptText, children: [_jsx(Download, { size: 12 }), " Download script"] }), _jsx(CopyButton, { text: runCommand })] }), (error || result) && (_jsxs("div", { className: "rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center gap-2", children: [result?.status === "passed" ? (_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-500" })) : (_jsx(AlertTriangle, { className: "w-4 h-4 text-amber-500" })), _jsx("span", { className: "text-xs font-semibold uppercase tracking-wide", children: result?.status || "Error" }), typeof result?.elapsed_ms === "number" && (_jsxs("span", { className: "text-xs text-slate-500", children: [result.elapsed_ms, " ms"] }))] }), typeof result?.exit_code === "number" && (_jsxs("span", { className: "text-[11px] text-slate-400 font-mono", children: ["exit ", result.exit_code] }))] }), _jsxs("div", { className: "p-3 space-y-2 text-xs", children: [error && _jsx("div", { className: "text-rose-600", children: error }), result?.stderr && _jsx("pre", { className: "font-mono bg-slate-950 text-rose-300 p-3 rounded overflow-auto max-h-72", children: result.stderr }), result?.stdout && _jsx("pre", { className: "font-mono bg-slate-950 text-emerald-300 p-3 rounded overflow-auto max-h-72", children: result.stdout })] })] }))] }), !!result && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [_jsxs("div", { className: "card p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Total requests" }), _jsx("div", { className: "text-lg font-semibold", children: parsedMetrics?.totalRequests ?? "—" })] }), _jsxs("div", { className: "card p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Requests/sec" }), _jsx("div", { className: "text-lg font-semibold", children: parsedMetrics?.requestsPerSecond?.toFixed(2) ?? "—" })] }), _jsxs("div", { className: "card p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "P95 latency" }), _jsx("div", { className: "text-lg font-semibold", children: parsedMetrics?.p95LatencyMs ? `${Math.round(parsedMetrics.p95LatencyMs)} ms` : "—" })] }), _jsxs("div", { className: "card p-3", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: "Error rate" }), _jsx("div", { className: "text-lg font-semibold", children: parsedMetrics?.errorRatePercent != null ? `${parsedMetrics.errorRatePercent.toFixed(2)}%` : "—" })] })] }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-4", children: [_jsx(ChartCard, { title: "Load Test Report - Latency", subtitle: "Average, P95, and max response time (ms)", children: latencyBars.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center text-xs text-slate-500", children: "No latency metrics found in this run output." })) : (_jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: latencyBars, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e2e8f0" }), _jsx(XAxis, { dataKey: "label" }), _jsx(YAxis, { unit: "ms" }), _jsx(Tooltip, { contentStyle: tooltipStyle(), formatter: (v) => [`${Number(v).toFixed(2)} ms`, "Value"] }), _jsx(Bar, { dataKey: "value", radius: [6, 6, 0, 0], children: latencyBars.map((entry, idx) => (_jsx(Cell, { fill: PALETTE[idx % PALETTE.length] }, entry.label))) })] }) })) }), _jsx(ChartCard, { title: "Load Test Report - Success vs Failure", subtitle: "Distribution from checks or request error rate", children: outcomePie.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center text-xs text-slate-500", children: "No pass/fail distribution found in this run output." })) : (_jsx(ResponsiveContainer, { children: _jsxs(PieChart, { children: [_jsx(Tooltip, { contentStyle: tooltipStyle(), formatter: (v, n) => [v, n] }), _jsx(Legend, { wrapperStyle: { fontSize: 11 } }), _jsx(Pie, { data: outcomePie, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", innerRadius: 52, outerRadius: 92, paddingAngle: 2, label: (entry) => `${entry.name}: ${entry.value}`, children: outcomePie.map((entry, idx) => (_jsx(Cell, { fill: idx === 0 ? "#10b981" : "#ef4444" }, entry.name))) })] }) })) })] })] })), _jsxs("div", { className: "grid lg:grid-cols-[1.2fr_0.8fr] gap-4", children: [_jsxs("div", { className: "card p-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800", children: [_jsx("div", { className: "text-sm font-medium", children: "Generated k6 script" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CopyButton, { text: scriptText || "" }), _jsx("button", { className: "btn-ghost text-xs", onClick: downloadScript, disabled: !scriptText, children: "Download" })] })] }), _jsx("pre", { className: "text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-[65vh] whitespace-pre-wrap", children: scriptQ.isLoading ? "Loading script…" : scriptText || "Select a collection to generate a script." })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "card p-4 space-y-2 text-xs text-slate-500", children: [_jsx("div", { className: "font-semibold text-slate-700 dark:text-slate-200", children: "Run command" }), _jsx("code", { className: "block font-mono bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded p-2 break-all", children: runCommand }), _jsxs("p", { children: ["The backend resolves ", _jsx("code", { children: `{{baseUrl}}` }), " from the selected environment before generating the script."] })] }), _jsxs("div", { className: "card p-4 space-y-2 text-xs text-slate-500", children: [_jsx("div", { className: "font-semibold text-slate-700 dark:text-slate-200", children: "Selected collection" }), _jsx("div", { children: selectedCollection?.name || "No collection selected" }), selectedCollection?.description && _jsx("p", { children: selectedCollection.description })] })] })] })] }));
}
