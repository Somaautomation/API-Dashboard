import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Play, Square, Copy, Check, RefreshCw, Eye } from "lucide-react";
import { useActiveEnv } from "@/store/env";
const LS_KEY = "automation-form";
const k6VusDefault = 50;
const k6DurationDefault = 120;
const k6P95Default = 500;
function statusBadge(s) {
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
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return (_jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", onClick: async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }, title: "Copy", children: [copied ? _jsx(Check, { size: 14, className: "text-emerald-500" }) : _jsx(Copy, { size: 14 }), copied ? "Copied" : "Copy"] }));
}
function sleep(ms) {
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
        }
        catch {
            return null;
        }
    })();
    const [collectionId, setCollectionId] = useState(initial?.collectionId ?? "");
    const [environmentId, setEnvironmentId] = useState(initial?.environmentId ?? activeEnvId ?? "");
    const [iterations, setIterations] = useState(initial?.iterations ?? 1);
    const [delayMs, setDelayMs] = useState(initial?.delayMs ?? 0);
    const [failFast, setFailFast] = useState(initial?.failFast ?? false);
    const [variablesText, setVariablesText] = useState(initial?.variablesText ?? "{}");
    const [k6Vus, setK6Vus] = useState(initial?.k6Vus ?? k6VusDefault);
    const [k6Duration, setK6Duration] = useState(initial?.k6Duration ?? k6DurationDefault);
    const [k6P95, setK6P95] = useState(initial?.k6P95 ?? k6P95Default);
    const [tab, setTab] = useState("runner");
    const [running, setRunning] = useState(false);
    const [cancelRequested, setCancelRequested] = useState(false);
    const [iterResults, setIterResults] = useState([]);
    const [drilling, setDrilling] = useState(null);
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
            localStorage.setItem(LS_KEY, JSON.stringify({
                collectionId,
                environmentId,
                iterations,
                delayMs,
                failFast,
                variablesText,
                k6Vus,
                k6Duration,
                k6P95,
            }));
        }
        catch {
            /* ignore quota */
        }
    }, [collectionId, environmentId, iterations, delayMs, failFast, variablesText, k6Vus, k6Duration, k6P95]);
    const collections = useQuery({
        queryKey: ["automation-collections"],
        queryFn: async () => (await api.get("/collections")).data,
    });
    const environments = useQuery({
        queryKey: ["automation-environments"],
        queryFn: async () => (await api.get("/environments")).data,
    });
    const runs = useQuery({
        queryKey: ["automation-runs"],
        queryFn: async () => (await api.get("/runs", { params: { limit: 20 } })).data,
        refetchInterval: tab === "history" ? 5000 : false,
    });
    const k6Script = useQuery({
        queryKey: ["automation-k6-script", collectionId, k6Vus, k6Duration, k6P95],
        queryFn: async () => {
            const { data } = await api.get(`/loadtest/${collectionId}/script`, {
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
    const collection = useMemo(() => collections.data?.find((c) => c.id === collectionId), [collections.data, collectionId]);
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
        if (!collectionId)
            return;
        let parsedVars = {};
        try {
            parsedVars = JSON.parse(variablesText || "{}");
        }
        catch {
            alert("Variables must be valid JSON (object of string→string)");
            return;
        }
        const n = Math.max(1, Math.min(100, Number(iterations) || 1));
        setRunning(true);
        setCancelRequested(false);
        setIterResults(Array.from({ length: n }, (_, i) => ({
            index: i + 1,
            status: "running",
            total: 0,
            passed: 0,
            failed: 0,
            duration_ms: 0,
        })));
        for (let i = 0; i < n; i++) {
            if (cancelRequested)
                break;
            try {
                const { data } = await api.post("/runs", {
                    collection_id: collectionId,
                    environment_id: environmentId || null,
                    variables: parsedVars,
                });
                setIterResults((prev) => prev.map((r, idx) => idx === i
                    ? {
                        ...r,
                        runId: data.id,
                        status: data.status,
                        total: data.total,
                        passed: data.passed,
                        failed: data.failed,
                        duration_ms: data.duration_ms,
                    }
                    : r));
                if (failFast && data.status !== "passed")
                    break;
            }
            catch (e) {
                setIterResults((prev) => prev.map((r, idx) => idx === i
                    ? {
                        ...r,
                        status: "error",
                        error: e?.response?.data?.detail || e?.message || "Request failed",
                    }
                    : r));
                if (failFast)
                    break;
            }
            if (delayMs > 0 && i < n - 1)
                await sleep(delayMs);
        }
        setRunning(false);
        qc.invalidateQueries({ queryKey: ["automation-runs"] });
    }
    const baseUrl = import.meta.env?.VITE_API_BASE_URL ?? "https://api.qa-zpecloud.com/api/v1";
    const curlSnippet = `# Trigger a collection run from any CI / shell
curl -X POST ${baseUrl}/runs \\
  -H "Authorization: Bearer $ZPE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
        collection_id: collectionId || "<COLLECTION_ID>",
        environment_id: environmentId || null,
        variables: {},
    }, null, 2)}'`;
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
        if (!k6Script.data)
            return;
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "API Automation" }), _jsx("p", { className: "text-sm text-slate-500", children: "Postman-style collection runner. Execute, iterate, schedule, and integrate with CI." })] }), _jsx("div", { className: "flex gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1", children: ["runner", "snippets", "history"].map((t) => (_jsx("button", { onClick: () => setTab(t), className: `px-3 py-1.5 text-xs rounded-md capitalize ${tab === t
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`, children: t }, t))) })] }), tab === "runner" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card p-4 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Collection" }), _jsxs("select", { className: "input mt-1", value: collectionId, onChange: (e) => setCollectionId(e.target.value), disabled: collections.isLoading, children: [_jsx("option", { value: "", children: collections.isLoading ? "Loading…" : "— Select a collection —" }), collections.data?.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Environment" }), _jsxs("select", { className: "input mt-1", value: environmentId, onChange: (e) => setActiveEnv(e.target.value || null), children: [_jsx("option", { value: "", children: "\u2014 None \u2014" }), environments.data?.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Iterations" }), _jsx("input", { type: "number", min: 1, max: 100, className: "input mt-1", value: iterations, onChange: (e) => setIterations(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Delay between iterations (ms)" }), _jsx("input", { type: "number", min: 0, step: 100, className: "input mt-1", value: delayMs, onChange: (e) => setDelayMs(Number(e.target.value)) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "text-xs text-slate-500", children: "Runtime variables (JSON, overrides environment)" }), _jsx("textarea", { className: "input font-mono text-xs mt-1", rows: 4, value: variablesText, onChange: (e) => setVariablesText(e.target.value) })] }), _jsx("div", { className: "md:col-span-2 flex items-center gap-3", children: _jsxs("label", { className: "text-xs flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: failFast, onChange: (e) => setFailFast(e.target.checked) }), "Stop on first failure (fail-fast)"] }) })] }), _jsxs("div", { className: "flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800", children: [!running ? (_jsxs("button", { className: "btn-primary flex items-center gap-2", disabled: !collectionId, onClick: runNow, children: [_jsx(Play, { size: 14 }), " Run now"] })) : (_jsxs("button", { className: "btn-ghost flex items-center gap-2 text-rose-600", onClick: () => setCancelRequested(true), children: [_jsx(Square, { size: 14 }), " Cancel"] })), collection && (_jsxs("span", { className: "text-xs text-slate-500", children: ["Target: ", _jsx("span", { className: "font-medium", children: collection.name })] }))] })] }), _jsxs("div", { className: "card p-4 space-y-4 border border-violet-200 dark:border-violet-900/50", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 flex-wrap", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-violet-700 dark:text-violet-300", children: "k6 test cases" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "Generate a ready-to-run k6 script from the selected collection and execute it locally with k6." })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", onClick: () => k6Script.refetch(), disabled: !collectionId || k6Script.isFetching, children: [_jsx(RefreshCw, { size: 12, className: k6Script.isFetching ? "animate-spin" : "" }), "Refresh script"] }), _jsx("button", { className: "btn-ghost text-xs flex items-center gap-1", onClick: downloadK6Script, disabled: !k6Script.data, children: "Download script" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Virtual users" }), _jsx("input", { type: "number", min: 1, className: "input mt-1", value: k6Vus, onChange: (e) => setK6Vus(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Ramp-up / duration preview" }), _jsx("input", { type: "number", min: 1, className: "input mt-1", value: k6Duration, onChange: (e) => setK6Duration(Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "P95 threshold (ms)" }), _jsx("input", { type: "number", min: 1, className: "input mt-1", value: k6P95, onChange: (e) => setK6P95(Number(e.target.value)) })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx(CopyButton, { text: k6Script.data || "" }), _jsx(CopyButton, { text: k6RunCommand }), _jsx("span", { className: "text-xs text-slate-500", children: "Run it from your shell after installing k6." })] }), _jsxs("div", { className: "grid md:grid-cols-[1.4fr_1fr] gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-slate-500 mb-2", children: "Generated k6 script" }), _jsx("pre", { className: "text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-96 rounded-md whitespace-pre-wrap", children: k6Script.isLoading
                                                    ? "Loading script…"
                                                    : k6Script.isError
                                                        ? "Failed to load k6 script"
                                                        : k6Script.data || "Select a collection to generate a script." })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40", children: [_jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2", children: "Run command" }), _jsx("code", { className: "block text-[11px] font-mono break-all bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2", children: k6RunCommand })] }), _jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 space-y-2", children: [_jsx("div", { className: "font-semibold text-slate-600 dark:text-slate-300", children: "What this does" }), _jsx("p", { children: "The script is generated from the selected collection\u2019s requests and stages the test with the k6 options shown above." }), _jsxs("p", { children: ["Save the script as a ", _jsx("code", { className: "font-mono", children: ".js" }), " file, then run ", _jsx("code", { className: "font-mono", children: "k6 run <file>" }), "."] })] })] })] })] }), iterResults.length > 0 && (_jsxs("div", { className: "card p-4 space-y-3", children: [running && (_jsx("div", { className: "w-full bg-slate-100 dark:bg-slate-800 rounded h-2 overflow-hidden", children: _jsx("div", { className: "h-full bg-sky-500 transition-all duration-300", style: { width: `${aggregate.progress}%` } }) })), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-6 gap-3 text-center", children: [_jsx(Stat, { label: "Iterations", value: `${aggregate.done}/${aggregate.total}` }), _jsx(Stat, { label: "Requests", value: aggregate.requests }), _jsx(Stat, { label: "Pass rate", value: `${aggregate.passRate}%`, cls: aggregate.passRate === 100
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : aggregate.passRate >= 80
                                                ? "text-amber-600 dark:text-amber-400"
                                                : "text-rose-600 dark:text-rose-400" }), _jsx(Stat, { label: "Passed", value: aggregate.passed, cls: "text-emerald-600 dark:text-emerald-400" }), _jsx(Stat, { label: "Failed", value: aggregate.failed, cls: "text-rose-600 dark:text-rose-400" }), _jsx(Stat, { label: "Avg ms", value: aggregate.avg })] }), _jsx("div", { className: "border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-800", children: iterResults.map((r) => (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 text-xs", children: [_jsxs("span", { className: "font-mono text-slate-400 w-10", children: ["#", r.index] }), _jsx("span", { className: `badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`, children: r.status }), _jsxs("span", { children: [r.passed, "/", r.total, " passed"] }), _jsxs("span", { className: "text-slate-500", children: ["\u00B7 ", r.duration_ms, " ms"] }), r.error && (_jsxs("span", { className: "text-rose-500 truncate", children: ["\u2014 ", r.error] })), r.runId && (_jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-ghost text-[11px] flex items-center gap-1 ml-auto", onClick: () => setDrilling(r.runId), title: "View per-request results", children: [_jsx(Eye, { size: 12 }), " View"] }), _jsx("span", { className: "font-mono text-slate-400", children: r.runId.slice(0, 8) })] }))] }, r.index))) })] }))] })), tab === "snippets" && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "card p-4 text-xs text-slate-500", children: ["Snippets below are pre-filled with your current selection (collection + environment). Use them to trigger the same run from CI/CD, cron, or any scripting language. Authenticate with a personal API token from", " ", _jsx("span", { className: "font-medium", children: "Settings \u2192 Tokens" }), "."] }), _jsx(Snippet, { title: "cURL", lang: "bash", code: curlSnippet }), _jsx(Snippet, { title: "GitHub Actions", lang: "yaml", code: ghaSnippet }), _jsx(Snippet, { title: "Node.js", lang: "javascript", code: nodeSnippet }), _jsx(Snippet, { title: "Python", lang: "python", code: pyScript })] })), tab === "history" && (_jsxs("div", { className: "card p-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800", children: [_jsx("div", { className: "text-sm font-medium", children: "Recent automation runs" }), _jsxs("button", { className: "btn-ghost text-xs flex items-center gap-1", onClick: () => runs.refetch(), children: [_jsx(RefreshCw, { size: 12 }), " Refresh"] })] }), _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-slate-50 dark:bg-slate-800/40 text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2", children: "Run ID" }), _jsx("th", { className: "text-left px-4 py-2", children: "Status" }), _jsx("th", { className: "text-left px-4 py-2", children: "Pass / Total" }), _jsx("th", { className: "text-left px-4 py-2", children: "Duration" }), _jsx("th", { className: "text-left px-4 py-2", children: "When" }), _jsx("th", { className: "text-left px-4 py-2" })] }) }), _jsxs("tbody", { children: [(runs.data ?? []).map((r) => (_jsxs("tr", { className: "border-t border-slate-100 dark:border-slate-800", children: [_jsx("td", { className: "px-4 py-2 font-mono text-slate-400", children: r.id.slice(0, 8) }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `badge px-1.5 py-0.5 font-bold ${statusBadge(r.status)}`, children: r.status }) }), _jsxs("td", { className: "px-4 py-2", children: [r.passed, "/", r.total] }), _jsxs("td", { className: "px-4 py-2", children: [r.duration_ms, " ms"] }), _jsx("td", { className: "px-4 py-2 text-slate-500", children: new Date(r.created_at).toLocaleString() }), _jsx("td", { className: "px-4 py-2", children: _jsxs("button", { className: "btn-ghost text-[11px] flex items-center gap-1", onClick: () => setDrilling(r.id), children: [_jsx(Eye, { size: 12 }), " View"] }) })] }, r.id))), (runs.data ?? []).length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-6 text-center text-slate-400", children: "No runs yet \u2014 trigger one from the Runner tab." }) }))] })] })] })), drilling && (_jsx(RunDrillModal, { runId: drilling, onClose: () => setDrilling(null) }))] }));
}
function Stat({ label, value, cls = "", }) {
    return (_jsxs("div", { className: "border border-slate-200 dark:border-slate-700 rounded-md p-2", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: label }), _jsx("div", { className: `text-lg font-bold ${cls}`, children: value })] }));
}
function Snippet({ title, lang, code }) {
    return (_jsxs("div", { className: "card p-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { className: "text-xs font-medium", children: [title, " ", _jsxs("span", { className: "text-slate-400", children: ["\u00B7 ", lang] })] }), _jsx(CopyButton, { text: code })] }), _jsx("pre", { className: "text-[11px] font-mono p-3 bg-slate-900 text-slate-100 overflow-auto max-h-96 whitespace-pre", children: code })] }));
}
function RunDrillModal({ runId, onClose }) {
    const { data, isLoading } = useQuery({
        queryKey: ["run-detail", runId],
        queryFn: async () => (await api.get(`/runs/${runId}`)).data,
    });
    const items = data?.summary?.items ?? [];
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-5xl w-full h-full flex flex-col", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-base font-semibold", children: ["Run details", data && (_jsx("span", { className: `ml-2 badge px-1.5 py-0.5 text-[11px] font-bold ${statusBadge(data.status)}`, children: data.status }))] }), _jsx("p", { className: "text-xs text-slate-500 font-mono mt-0.5", children: runId }), data && (_jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [data.passed, "/", data.total, " passed \u00B7 ", data.duration_ms, " ms"] }))] }), _jsx("button", { className: "btn-ghost", onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: "overflow-auto p-4 space-y-3 flex-1", children: [isLoading && _jsx("div", { className: "text-sm text-slate-500", children: "Loading\u2026" }), !isLoading && items.length === 0 && (_jsx("div", { className: "text-sm text-slate-500", children: "No per-request data captured." })), items.map((it, idx) => (_jsxs("details", { className: "border border-slate-200 dark:border-slate-700 rounded", children: [_jsxs("summary", { className: "flex items-center gap-2 px-3 py-2 cursor-pointer text-xs", children: [_jsxs("span", { className: "font-mono w-6 text-slate-400", children: ["#", idx + 1] }), it.method && (_jsx("span", { className: "badge px-1.5 py-0.5 font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", children: it.method })), typeof it.status_code === "number" && (_jsx("span", { className: `badge px-1.5 py-0.5 font-bold ${it.status_code < 300
                                                ? "bg-emerald-100 text-emerald-700"
                                                : it.status_code < 400
                                                    ? "bg-sky-100 text-sky-700"
                                                    : it.status_code < 500
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-rose-100 text-rose-700"}`, children: it.status_code })), _jsx("span", { className: "flex-1 truncate font-mono", children: it.url || it.name }), typeof it.duration_ms === "number" && (_jsxs("span", { className: "text-slate-500", children: [it.duration_ms, " ms"] })), it.error && _jsx("span", { className: "text-rose-500 text-[11px]", children: "ERR" })] }), _jsxs("div", { className: "p-3 space-y-2 text-xs border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40", children: [_jsx("div", { className: "font-mono text-[11px] text-slate-500 break-all", children: it.name }), it.error && (_jsx("div", { className: "text-rose-600 font-mono text-[11px]", children: it.error })), it.response_body && (_jsx("pre", { className: "bg-slate-950 text-emerald-300 text-[11px] font-mono p-2 rounded overflow-auto max-h-72", children: (() => {
                                                try {
                                                    return JSON.stringify(JSON.parse(it.response_body), null, 2);
                                                }
                                                catch {
                                                    return it.response_body;
                                                }
                                            })() })), (data?.assertions ?? []).filter((a) => a.item_name === it.name).map((a, i) => (_jsxs("div", { className: `text-[11px] px-2 py-1 rounded ${a.passed
                                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`, children: [a.passed ? "✓" : "✗", " ", _jsx("code", { children: a.assertion_type }), " \u2014 ", a.message] }, i)))] })] }, idx)))] })] }) }));
}
