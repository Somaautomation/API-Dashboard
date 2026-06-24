import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { Copy, Play, Trash2, ServerCog, CheckCircle2, XCircle } from "lucide-react";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHOD_BADGE = {
    GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    POST: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    PATCH: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
};
const EMPTY_FORM = {
    name: "",
    method: "GET",
    path: "/example",
    status_code: 200,
    delay_ms: 0,
    enabled: true,
    headers: '{\n  "Content-Type": "application/json"\n}',
    response_body: '{\n  "hello": "world"\n}',
    response_schema: "",
};
export default function Mocks() {
    const qc = useQueryClient();
    const [form, setForm] = useState(EMPTY_FORM);
    const [parseError, setParseError] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const apiBase = useMemo(() => api.defaults.baseURL?.replace(/\/+$/, "") ?? "", []);
    const { data: mocks, isLoading } = useQuery({
        queryKey: ["mocks"],
        queryFn: async () => (await api.get("/mocks")).data,
    });
    const create = useMutation({
        mutationFn: async () => {
            setParseError(null);
            let headers = {};
            let response_body = null;
            let response_schema = null;
            try {
                if (form.headers.trim())
                    headers = JSON.parse(form.headers);
            }
            catch {
                throw new Error("Headers must be valid JSON object");
            }
            try {
                if (form.response_body.trim())
                    response_body = JSON.parse(form.response_body);
            }
            catch {
                throw new Error("Response body must be valid JSON");
            }
            try {
                if (form.response_schema.trim())
                    response_schema = JSON.parse(form.response_schema);
            }
            catch {
                throw new Error("Response schema must be valid JSON");
            }
            return (await api.post("/mocks", {
                name: form.name,
                method: form.method,
                path: form.path.startsWith("/") ? form.path : `/${form.path}`,
                status_code: form.status_code,
                delay_ms: form.delay_ms,
                enabled: form.enabled,
                headers,
                response_body,
                response_schema,
            })).data;
        },
        onSuccess: () => {
            setForm(EMPTY_FORM);
            qc.invalidateQueries({ queryKey: ["mocks"] });
        },
        onError: (err) => setParseError(err?.message ?? "Failed to create mock"),
    });
    const del = useMutation({
        mutationFn: async (id) => api.delete(`/mocks/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["mocks"] }),
    });
    const mockUrl = (m) => `${apiBase}/mocks/run${m.path.startsWith("/") ? m.path : "/" + m.path}`;
    async function testMock(m) {
        setTestResult(null);
        const url = mockUrl(m);
        const t0 = performance.now();
        try {
            const res = await fetch(url, { method: m.method });
            const text = await res.text();
            setTestResult({
                id: m.id,
                status: res.status,
                ok: res.ok,
                body: text,
                durationMs: Math.round(performance.now() - t0),
            });
        }
        catch (e) {
            setTestResult({
                id: m.id,
                status: 0,
                ok: false,
                body: String(e?.message ?? e),
                durationMs: Math.round(performance.now() - t0),
            });
        }
    }
    function copy(text) {
        navigator.clipboard?.writeText(text).catch(() => { });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsxs("h1", { className: "h-title flex items-center gap-2", children: [_jsx(ServerCog, { className: "text-fuchsia-500" }), " Mock APIs"] }), _jsxs("p", { className: "text-sm text-slate-500", children: ["Define stub endpoints served from ", _jsx("code", { className: "font-mono text-xs", children: "/api/v1/mocks/run/<path>" })] })] }), _jsxs("span", { className: "badge-violet", children: [mocks?.length ?? 0, " mocks"] })] }), _jsxs("div", { className: "card p-5 space-y-4", children: [_jsx("h2", { className: "font-semibold text-sm bg-gradient-brand bg-clip-text text-transparent", children: "Create a new mock" }), _jsxs("div", { className: "grid md:grid-cols-6 gap-3", children: [_jsx("input", { className: "input md:col-span-2", placeholder: "Mock name", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx("select", { className: "input", value: form.method, onChange: (e) => setForm({ ...form, method: e.target.value }), children: METHODS.map((x) => _jsx("option", { children: x }, x)) }), _jsx("input", { className: "input md:col-span-2", placeholder: "/path", value: form.path, onChange: (e) => setForm({ ...form, path: e.target.value }) }), _jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: form.enabled, onChange: (e) => setForm({ ...form, enabled: e.target.checked }), className: "h-4 w-4 accent-brand-500" }), "Enabled"] }), _jsx("input", { className: "input", type: "number", placeholder: "Status", value: form.status_code, onChange: (e) => setForm({ ...form, status_code: +e.target.value }) }), _jsx("input", { className: "input", type: "number", placeholder: "Delay (ms)", value: form.delay_ms, onChange: (e) => setForm({ ...form, delay_ms: +e.target.value }) })] }), _jsxs("div", { className: "grid md:grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Headers (JSON)" }), _jsx("textarea", { className: "input font-mono text-xs mt-1 h-32", value: form.headers, onChange: (e) => setForm({ ...form, headers: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Response body (JSON)" }), _jsx("textarea", { className: "input font-mono text-xs mt-1 h-32", value: form.response_body, onChange: (e) => setForm({ ...form, response_body: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Dynamic schema (JSON Schema \u00B7 optional, overrides body)" }), _jsx("textarea", { className: "input font-mono text-xs mt-1 h-32", placeholder: '{"type":"object","properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"}}}', value: form.response_schema, onChange: (e) => setForm({ ...form, response_schema: e.target.value }) })] })] }), parseError && _jsx("div", { className: "text-sm text-rose-600", children: parseError }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "btn-primary", disabled: !form.name || create.isPending, onClick: () => create.mutate(), children: create.isPending ? "Saving…" : "Create mock" }), _jsx("button", { className: "btn-ghost", type: "button", onClick: () => { setForm(EMPTY_FORM); setParseError(null); }, children: "Reset" })] })] }), _jsx("div", { className: "card overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-left text-xs uppercase tracking-wide text-slate-500\r\n                            bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2", children: "Name" }), _jsx("th", { className: "px-2 py-2", children: "Method" }), _jsx("th", { className: "px-2 py-2", children: "Path" }), _jsx("th", { className: "px-2 py-2", children: "Status" }), _jsx("th", { className: "px-2 py-2", children: "Delay" }), _jsx("th", { className: "px-2 py-2", children: "State" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Actions" })] }) }), _jsxs("tbody", { children: [isLoading && (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-6 text-center text-slate-500", children: "Loading\u2026" }) })), !isLoading && (mocks?.length ?? 0) === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-6 text-center text-slate-500", children: "No mocks yet \u2014 create one above." }) })), mocks?.map((x) => (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30", children: [_jsx("td", { className: "px-4 py-2 font-medium", children: x.name }), _jsx("td", { className: "px-2 py-2", children: _jsx("span", { className: `badge ${METHOD_BADGE[x.method] ?? "badge-info"}`, children: x.method }) }), _jsx("td", { className: "px-2 py-2 font-mono text-xs", children: x.path }), _jsx("td", { className: "px-2 py-2", children: x.status_code }), _jsxs("td", { className: "px-2 py-2", children: [x.delay_ms, " ms"] }), _jsx("td", { className: "px-2 py-2", children: x.enabled
                                                        ? _jsx("span", { className: "badge-success", children: "enabled" })
                                                        : _jsx("span", { className: "badge-warn", children: "disabled" }) }), _jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { className: "btn-ghost", title: "Copy URL", onClick: () => copy(mockUrl(x)), children: _jsx(Copy, { size: 14 }) }), _jsxs("button", { className: "btn-secondary", title: "Test", onClick: () => testMock(x), children: [_jsx(Play, { size: 14 }), " Test"] }), _jsx("button", { className: "btn-ghost text-rose-600", title: "Delete", onClick: () => del.mutate(x.id), children: _jsx(Trash2, { size: 14 }) })] }) })] }, x.id), testResult?.id === x.id && (_jsx("tr", { className: "border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40", children: _jsxs("td", { colSpan: 7, className: "px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [testResult.ok
                                                                ? _jsx(CheckCircle2, { size: 14, className: "text-emerald-500" })
                                                                : _jsx(XCircle, { size: 14, className: "text-rose-500" }), _jsxs("span", { className: "font-medium", children: ["HTTP ", testResult.status || "ERR"] }), _jsxs("span", { className: "text-slate-500", children: ["\u00B7 ", testResult.durationMs, " ms"] }), _jsx("span", { className: "text-slate-400 font-mono break-all", children: mockUrl(x) })] }), _jsx("pre", { className: "mt-2 text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-64", children: tryPretty(testResult.body) })] }) }, `${x.id}-result`))] })))] })] }) })] }));
}
function tryPretty(s) {
    try {
        return JSON.stringify(JSON.parse(s), null, 2);
    }
    catch {
        return s;
    }
}
