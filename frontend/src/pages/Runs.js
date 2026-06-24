import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
function statusBadge(status) {
    const base = "badge text-xs px-2 py-0.5 rounded";
    if (status === "passed")
        return `${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300`;
    if (status === "failed")
        return `${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300`;
    if (status === "running")
        return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
    return `${base} bg-slate-100 dark:bg-slate-800`;
}
function methodColor(m) {
    switch (m) {
        case "GET": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
        case "POST": return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
        case "PUT": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
        case "PATCH": return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
        case "DELETE": return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
        default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
}
function statusCodeColor(code) {
    if (code === undefined)
        return "bg-slate-200 text-slate-700";
    if (code < 300)
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    if (code < 400)
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    if (code < 500)
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}
function prettyBody(body) {
    if (!body)
        return "";
    const trimmed = body.trim();
    if (!trimmed)
        return "";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.stringify(JSON.parse(trimmed), null, 2);
        }
        catch {
            /* fall through */
        }
    }
    return body;
}
function RequestPanel({ items }) {
    const [openIdx, setOpenIdx] = useState(items.length ? 0 : null);
    if (!items.length) {
        return (_jsx("div", { className: "text-xs text-slate-500 italic", children: "No per-request data captured (run was created before response capture was enabled)." }));
    }
    return (_jsx("div", { className: "border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-800", children: items.map((it, i) => {
            const open = openIdx === i;
            return (_jsxs("div", { children: [_jsxs("button", { className: "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40", onClick: () => setOpenIdx(open ? null : i), children: [_jsx("span", { className: "text-slate-400 text-xs w-4", children: open ? "▾" : "▸" }), _jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method)}`, children: it.method || "?" }), it.error ? (_jsx("span", { className: "badge px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", children: "ERR" })) : (_jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${statusCodeColor(it.status_code)}`, children: it.status_code })), _jsx("span", { className: "text-xs font-medium", children: it.name }), _jsx("span", { className: "text-xs font-mono text-slate-500 truncate flex-1", title: it.url, children: it.url }), _jsxs("span", { className: "text-[11px] text-slate-500 whitespace-nowrap", children: [it.duration_ms ?? 0, " ms"] })] }), open && (_jsxs("div", { className: "px-3 pb-3 space-y-2 bg-slate-50/60 dark:bg-slate-900/30", children: [it.error && (_jsx("div", { className: "text-xs text-red-600 font-mono whitespace-pre-wrap break-all", children: it.error })), it.response_headers && Object.keys(it.response_headers).length > 0 && (_jsxs("details", { className: "text-xs", children: [_jsxs("summary", { className: "cursor-pointer text-slate-500", children: ["Response headers (", Object.keys(it.response_headers).length, ")"] }), _jsx("pre", { className: "mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] overflow-auto max-h-40", children: Object.entries(it.response_headers)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join("\n") })] })), it.response_body !== undefined && (_jsxs("details", { open: true, className: "text-xs", children: [_jsxs("summary", { className: "cursor-pointer text-slate-500", children: ["Response body", " ", it.response_size !== undefined && (_jsxs("span", { className: "text-slate-400", children: ["(", it.response_size, " bytes", it.response_truncated ? ", truncated to 8 KB" : "", ")"] }))] }), _jsx("pre", { className: "mt-1 p-2 rounded bg-slate-900 text-slate-100 text-[11px] overflow-auto max-h-72 whitespace-pre-wrap break-all", children: prettyBody(it.response_body) || "(empty)" })] }))] }))] }, i));
        }) }));
}
export default function Runs() {
    const [selectedId, setSelectedId] = useState(null);
    const qc = useQueryClient();
    const { data: runs, isLoading, refetch } = useQuery({
        queryKey: ["runs"],
        queryFn: async () => (await api.get("/runs")).data,
        refetchInterval: 5000,
    });
    const { data: detail } = useQuery({
        queryKey: ["run", selectedId],
        queryFn: async () => (await api.get(`/runs/${selectedId}`)).data,
        enabled: !!selectedId,
    });
    const rerun = useMutation({
        mutationFn: async (collectionId) => (await api.post(`/runs`, { collection_id: collectionId, variables: {} })).data,
        onSuccess: (r) => {
            qc.invalidateQueries({ queryKey: ["runs"] });
            setSelectedId(r.id);
        },
        onError: (e) => alert(`Re-run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
    });
    function reportUrl(id, kind) {
        return `${api.defaults.baseURL}/reports/runs/${id}/${kind}`;
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Execution Reports" }), _jsx("button", { className: "btn-ghost border border-slate-200 dark:border-slate-700", onClick: () => refetch(), children: "Refresh" })] }), _jsxs("div", { className: "grid lg:grid-cols-[1fr_1.4fr] gap-4", children: [_jsxs("div", { className: "card p-0 overflow-hidden", children: [_jsxs("div", { className: "px-4 py-2 text-xs font-medium text-slate-500 border-b border-slate-200 dark:border-slate-800", children: ["Runs ", runs ? `(${runs.length})` : ""] }), _jsxs("div", { className: "max-h-[70vh] overflow-auto divide-y divide-slate-100 dark:divide-slate-800", children: [isLoading && _jsx("div", { className: "p-4 text-sm text-slate-500", children: "Loading\u2026" }), runs?.length === 0 && (_jsxs("div", { className: "p-4 text-sm text-slate-500", children: ["No runs yet. Trigger one from the ", _jsx("b", { children: "Collections" }), " page."] })), runs?.map((r) => (_jsxs("button", { onClick: () => setSelectedId(r.id), className: `w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedId === r.id ? "bg-slate-100 dark:bg-slate-800/70" : ""}`, children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: statusBadge(r.status), children: r.status }), _jsx("span", { className: "text-xs text-slate-500", children: new Date(r.created_at).toLocaleString() })] }), _jsx("div", { className: "mt-1 text-xs text-slate-500 font-mono truncate", children: r.id }), _jsxs("div", { className: "mt-1 text-xs", children: [_jsxs("span", { className: "text-green-600", children: [r.passed, " passed"] }), " · ", _jsxs("span", { className: "text-red-600", children: [r.failed, " failed"] }), " · ", _jsxs("span", { className: "text-slate-500", children: [r.duration_ms, " ms"] })] })] }, r.id)))] })] }), _jsxs("div", { className: "card p-4", children: [!selectedId && _jsx("div", { className: "text-sm text-slate-500", children: "Select a run to see assertion details." }), selectedId && !detail && _jsx("div", { className: "text-sm text-slate-500", children: "Loading run\u2026" }), detail && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: statusBadge(detail.status), children: detail.status }), _jsxs("span", { className: "text-sm", children: [detail.passed, "/", detail.total, " passed \u00B7 ", detail.duration_ms, " ms"] })] }), _jsx("div", { className: "text-xs text-slate-500 font-mono mt-1", children: detail.id })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "btn-primary", disabled: !detail.collection_id || rerun.isPending, onClick: () => detail.collection_id && rerun.mutate(detail.collection_id), title: "Re-run the same collection", children: rerun.isPending ? "Re-running…" : "Re-run" }), _jsx("a", { className: "btn-ghost border border-slate-200 dark:border-slate-700", href: reportUrl(detail.id, "pdf"), target: "_blank", rel: "noreferrer", children: "PDF" }), _jsx("a", { className: "btn-ghost border border-slate-200 dark:border-slate-700", href: reportUrl(detail.id, "excel"), target: "_blank", rel: "noreferrer", children: "Excel" })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-slate-500 mb-1", children: "Requests & responses" }), _jsx(RequestPanel, { items: detail.summary?.items ?? [] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-2 pr-3", children: "Item" }), _jsx("th", { className: "text-left py-2 pr-3", children: "Assertion" }), _jsx("th", { className: "text-left py-2 pr-3", children: "Result" }), _jsx("th", { className: "text-left py-2", children: "Message" })] }) }), _jsxs("tbody", { className: "divide-y divide-slate-100 dark:divide-slate-800", children: [detail.assertions?.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "py-3 text-slate-500", children: "No assertions recorded." }) })), detail.assertions?.map((a, i) => (_jsxs("tr", { children: [_jsx("td", { className: "py-2 pr-3 font-medium", children: a.item_name }), _jsx("td", { className: "py-2 pr-3 font-mono text-xs", children: a.assertion_type }), _jsx("td", { className: "py-2 pr-3", children: _jsx("span", { className: a.passed
                                                                            ? "text-green-600 font-medium"
                                                                            : "text-red-600 font-medium", children: a.passed ? "PASS" : "FAIL" }) }), _jsx("td", { className: "py-2 text-slate-600 dark:text-slate-300", children: a.message })] }, i)))] })] }) })] }))] })] })] }));
}
