import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Copy, Globe, Play, Trash2, Upload, Link as LinkIcon, ExternalLink, KeyRound, LogIn, LogOut, CheckCircle2, Sparkles, } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";
import { useZpeAuth } from "@/store/zpeAuth";
import { AiTestGeneratorModal } from "@/components/AiTestGeneratorModal";
const METHOD_COLORS = {
    GET: "bg-emerald-500 text-white",
    POST: "bg-amber-500 text-white",
    PUT: "bg-blue-500 text-white",
    PATCH: "bg-violet-500 text-white",
    DELETE: "bg-rose-500 text-white",
    HEAD: "bg-slate-500 text-white",
    OPTIONS: "bg-slate-500 text-white",
};
// --- JSON Schema -> example value (best effort, handles $ref by ignoring) ----
function exampleFromSchema(schema, depth = 0) {
    if (!schema || depth > 6)
        return null;
    if (schema.example !== undefined)
        return schema.example;
    if (schema.default !== undefined)
        return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length)
        return schema.enum[0];
    const t = schema.type;
    if (t === "object" || schema.properties) {
        const out = {};
        for (const [k, v] of Object.entries(schema.properties || {})) {
            out[k] = exampleFromSchema(v, depth + 1);
        }
        return out;
    }
    if (t === "array")
        return [exampleFromSchema(schema.items, depth + 1)];
    if (t === "string") {
        if (schema.format === "date-time")
            return new Date().toISOString();
        if (schema.format === "email")
            return "user@example.com";
        if (schema.format === "uuid")
            return "00000000-0000-0000-0000-000000000000";
        return "string";
    }
    if (t === "integer" || t === "number")
        return 0;
    if (t === "boolean")
        return true;
    return null;
}
function statusTone(code) {
    if (code === 0)
        return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
    if (code < 300)
        return "bg-emerald-500 text-white";
    if (code < 400)
        return "bg-sky-500 text-white";
    if (code < 500)
        return "bg-amber-500 text-white";
    return "bg-rose-600 text-white";
}
function prettify(body, ctype) {
    if (ctype.includes("json")) {
        try {
            return JSON.stringify(JSON.parse(body), null, 2);
        }
        catch {
            /* fallthrough */
        }
    }
    return body;
}
function schemaKind(schema) {
    if (!schema || typeof schema !== "object")
        return "unknown";
    if (schema.type)
        return schema.type;
    if (schema.properties)
        return "object";
    if (schema.items)
        return "array";
    return "schema";
}
function SchemaSection({ schema }) {
    if (!schema)
        return null;
    return (_jsxs("div", { className: "rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900/60", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Request schema" }), _jsx("div", { className: "text-[11px] text-slate-400 mt-0.5", children: "Rendered from the passed JSON Schema object." })] }), _jsx("span", { className: "px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200", children: schemaKind(schema) })] }), _jsx("div", { className: "p-3", children: _jsx(SchemaNode, { schema: schema, name: "body", depth: 0 }) })] }));
}
function SchemaNode({ schema, name, depth, }) {
    if (!schema || typeof schema !== "object")
        return null;
    const type = schemaKind(schema);
    const required = Array.isArray(schema.required) ? new Set(schema.required) : new Set();
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : null;
    const title = name ? name : schema.title || "schema";
    const hasChildren = Boolean(properties || schema.items);
    const indentClass = depth === 0 ? "" : "ml-4 pl-4 border-l border-slate-200 dark:border-slate-700";
    return (_jsxs("div", { className: `space-y-3 ${indentClass}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-3 flex-wrap", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-slate-900 dark:text-slate-100", children: title }), _jsxs("div", { className: "text-[11px] text-slate-500 font-mono", children: ["type: ", type] })] }), _jsxs("div", { className: "flex items-center gap-2 text-[11px]", children: [schema.format && (_jsxs("span", { className: "px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", children: ["format: ", schema.format] })), schema.nullable && (_jsx("span", { className: "px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", children: "nullable" }))] })] }), (schema.description || schema.example !== undefined || schema.default !== undefined) && (_jsxs("div", { className: "grid gap-2 text-xs text-slate-600 dark:text-slate-300", children: [schema.description && _jsx("p", { children: schema.description }), schema.example !== undefined && (_jsxs("div", { className: "font-mono text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded px-2 py-1 overflow-auto", children: ["example: ", JSON.stringify(schema.example, null, 2)] })), schema.default !== undefined && (_jsxs("div", { className: "font-mono text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded px-2 py-1 overflow-auto", children: ["default: ", JSON.stringify(schema.default, null, 2)] }))] })), type === "object" && properties && (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: "Properties" }), _jsx("div", { className: "space-y-2", children: Object.entries(properties).map(([propName, propSchema]) => (_jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3", children: [_jsx(SchemaNode, { schema: propSchema, name: propName, depth: depth + 1 }), required.has(propName) && (_jsx("div", { className: "mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400", children: "required" }))] }, propName))) })] })), type === "array" && schema.items && (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500", children: "Items" }), _jsx("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3", children: _jsx(SchemaNode, { schema: schema.items, name: "item", depth: depth + 1 }) })] })), !hasChildren && schema.enum?.length && (_jsxs("div", { className: "text-[11px] text-slate-500 font-mono", children: ["enum: ", schema.enum.join(", ")] }))] }));
}
// --- Endpoint accordion item -----------------------------------------------
function EndpointRow({ ep, servers }) {
    const [open, setOpen] = useState(false);
    const { selectedId } = useActiveEnv();
    const { data: envs } = useQuery({
        queryKey: ["envs-for-try"],
        queryFn: async () => (await api.get("/environments")).data,
        staleTime: 60_000,
    });
    const activeEnv = useMemo(() => envs?.find((e) => e.id === selectedId) ?? null, [envs, selectedId]);
    const serverOptions = useMemo(() => {
        const list = [];
        if (activeEnv?.base_url)
            list.push(activeEnv.base_url);
        for (const s of servers)
            if (!list.includes(s))
                list.push(s);
        if (!list.length)
            list.push("https://api.example.com");
        return list;
    }, [activeEnv, servers]);
    const [serverUrl, setServerUrl] = useState(serverOptions[0]);
    useEffect(() => {
        setServerUrl(serverOptions[0]);
    }, [serverOptions]);
    const pathParams = ep.parameters.filter((p) => p.in === "path");
    const queryParams = ep.parameters.filter((p) => p.in === "query");
    const headerParams = ep.parameters.filter((p) => p.in === "header");
    // state for inputs
    const [pathVals, setPathVals] = useState({});
    const [queryVals, setQueryVals] = useState({});
    const [headerVals, setHeaderVals] = useState({});
    const [extraHeaders, setExtraHeaders] = useState([]);
    const storedToken = useZpeAuth((s) => s.token);
    const setStoredToken = useZpeAuth((s) => s.setToken);
    const cookieHeader = useZpeAuth((s) => s.cookieHeader());
    const xsrfToken = useZpeAuth((s) => s.cookies["XSRF-TOKEN"] || "");
    const [bearer, setBearer] = useState(storedToken);
    const [cookieVal, setCookieVal] = useState(cookieHeader);
    useEffect(() => {
        // Pick up token if it changes elsewhere (e.g. Quick Login) while this row is closed.
        if (storedToken && !bearer)
            setBearer(storedToken);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storedToken]);
    useEffect(() => {
        if (cookieHeader && !cookieVal)
            setCookieVal(cookieHeader);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cookieHeader]);
    const [bodyText, setBodyText] = useState(() => ep.request_schema ? JSON.stringify(exampleFromSchema(ep.request_schema), null, 2) : "");
    const [bodyError, setBodyError] = useState(null);
    const [resp, setResp] = useState(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const tryMut = useMutation({
        mutationFn: async (payload) => (await api.post("/swagger/try", payload)).data,
        onSuccess: (data) => setResp(data),
        onError: (e) => setResp({
            status: 0,
            elapsed_ms: 0,
            headers: {},
            cookies: {},
            body: e?.response?.data?.error?.message ?? String(e),
            content_type: "",
            error: "request failed",
        }),
    });
    // build resolved URL
    const resolvedPath = useMemo(() => {
        let p = ep.path;
        for (const pp of pathParams) {
            const val = pathVals[pp.name] ?? `{${pp.name}}`;
            p = p.replace(`{${pp.name}}`, encodeURIComponent(val));
        }
        return p;
    }, [ep.path, pathParams, pathVals]);
    const fullUrl = (serverUrl || "").replace(/\/$/, "") + resolvedPath;
    function buildHeaders() {
        const out = {};
        for (const h of headerParams) {
            const v = headerVals[h.name];
            if (v)
                out[h.name] = v;
        }
        for (const { k, v } of extraHeaders)
            if (k && v)
                out[k] = v;
        if (bearer.trim())
            out["Authorization"] = `Bearer ${bearer.trim()}`;
        if (cookieVal.trim())
            out["Cookie"] = cookieVal.trim();
        if (xsrfToken && !out["X-Xsrf-Token"])
            out["X-Xsrf-Token"] = xsrfToken;
        return out;
    }
    function execute() {
        setBodyError(null);
        let parsedBody = null;
        let body_kind = "none";
        if (bodyText.trim() && !["GET", "HEAD"].includes(ep.method.toUpperCase())) {
            try {
                parsedBody = JSON.parse(bodyText);
                body_kind = "json";
            }
            catch (e) {
                setBodyError("Body is not valid JSON");
                return;
            }
        }
        const q = {};
        for (const [k, v] of Object.entries(queryVals))
            if (v)
                q[k] = v;
        tryMut.mutate({
            method: ep.method,
            url: fullUrl,
            headers: buildHeaders(),
            query: q,
            body: parsedBody,
            body_kind,
        });
    }
    return (_jsxs("div", { className: "border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left", children: [open ? (_jsx(ChevronDown, { className: "w-4 h-4 text-slate-400" })) : (_jsx(ChevronRight, { className: "w-4 h-4 text-slate-400" })), _jsx("span", { className: `px-2 py-0.5 rounded text-xs font-mono font-bold w-16 text-center ${METHOD_COLORS[ep.method] ?? "bg-slate-300 text-slate-700"}`, children: ep.method }), _jsx("code", { className: "text-sm font-mono break-all flex-1", children: ep.path }), ep.summary && (_jsx("span", { className: "hidden md:block text-xs text-slate-500 truncate max-w-md", children: ep.summary }))] }), open && (_jsxs("div", { className: "p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 space-y-4", children: [ep.summary && (_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300", children: ep.summary })), _jsxs("div", { className: "grid md:grid-cols-[1fr_auto] gap-2 items-end", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Server URL ", activeEnv && _jsxs("span", { className: "text-emerald-600", children: ["(env: ", activeEnv.name, ")"] })] }), _jsx("select", { className: "input mt-1", value: serverUrl, onChange: (e) => setServerUrl(e.target.value), children: serverOptions.map((s) => (_jsx("option", { value: s, children: s }, s))) })] }), _jsxs("div", { className: "text-xs", children: [_jsx("div", { className: "font-semibold text-slate-500 uppercase tracking-wide", children: "Full URL" }), _jsx("div", { className: "mt-1 font-mono text-[11px] break-all bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700", children: fullUrl })] })] }), pathParams.length > 0 && (_jsx(ParamSection, { title: "Path parameters", params: pathParams, values: pathVals, onChange: setPathVals })), queryParams.length > 0 && (_jsx(ParamSection, { title: "Query parameters", params: queryParams, values: queryVals, onChange: setQueryVals })), ep.request_schema && _jsx(SchemaSection, { schema: ep.request_schema }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Headers" }), _jsx("button", { type: "button", className: "text-xs text-indigo-600 hover:underline", onClick: () => setExtraHeaders((h) => [...h, { k: "", v: "" }]), children: "+ Add header" })] }), _jsxs("div", { className: "space-y-2 mt-2", children: [headerParams.map((h) => (_jsxs("div", { className: "grid grid-cols-[200px_1fr] gap-2", children: [_jsx("input", { className: "input", value: h.name, readOnly: true, title: h.required ? "Required" : "Optional" }), _jsx("input", { className: "input", placeholder: h.description || h.schema?.type || "value", value: headerVals[h.name] ?? "", onChange: (e) => setHeaderVals((v) => ({ ...v, [h.name]: e.target.value })) })] }, h.name))), extraHeaders.map((row, i) => (_jsxs("div", { className: "grid grid-cols-[200px_1fr_auto] gap-2", children: [_jsx("input", { className: "input", placeholder: "Header-Name", value: row.k, onChange: (e) => setExtraHeaders((arr) => arr.map((r, j) => (j === i ? { ...r, k: e.target.value } : r))) }), _jsx("input", { className: "input", placeholder: "value", value: row.v, onChange: (e) => setExtraHeaders((arr) => arr.map((r, j) => (j === i ? { ...r, v: e.target.value } : r))) }), _jsx("button", { type: "button", className: "btn-ghost text-rose-600", onClick: () => setExtraHeaders((arr) => arr.filter((_, j) => j !== i)), children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, i))), _jsxs("div", { className: "grid grid-cols-[200px_1fr] gap-2", children: [_jsx("input", { className: "input", value: "Authorization (Bearer)", readOnly: true }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input flex-1", placeholder: "paste access token (without 'Bearer ')", value: bearer, onChange: (e) => {
                                                            setBearer(e.target.value);
                                                            setStoredToken(e.target.value);
                                                        } }), storedToken && bearer !== storedToken && (_jsx("button", { type: "button", className: "btn-ghost text-xs whitespace-nowrap", onClick: () => setBearer(storedToken), title: "Use the token saved via Quick Login", children: "Use saved" }))] })] }), _jsxs("div", { className: "grid grid-cols-[200px_1fr] gap-2", children: [_jsx("input", { className: "input", value: "Cookie", readOnly: true }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input flex-1 font-mono text-xs", placeholder: "e.g. session=abc; XSRF-TOKEN=xyz", value: cookieVal, onChange: (e) => setCookieVal(e.target.value) }), cookieHeader && cookieVal !== cookieHeader && (_jsx("button", { type: "button", className: "btn-ghost text-xs whitespace-nowrap", onClick: () => setCookieVal(cookieHeader), title: "Use cookies captured via Quick Login", children: "Use saved" }))] })] }), xsrfToken && (_jsxs("div", { className: "text-[11px] text-emerald-600 dark:text-emerald-400 pl-[208px]", children: ["\u2713 X-Xsrf-Token header will be auto-added (", xsrfToken.slice(0, 12), "\u2026)"] }))] })] }), !["GET", "HEAD"].includes(ep.method.toUpperCase()) && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Request body (JSON)" }), ep.request_schema && (_jsx("button", { type: "button", className: "text-xs text-indigo-600 hover:underline", onClick: () => setBodyText(JSON.stringify(exampleFromSchema(ep.request_schema), null, 2)), children: "Reset to example" }))] }), _jsx("textarea", { className: "input mt-2 font-mono text-xs", rows: Math.min(14, Math.max(4, bodyText.split("\n").length)), value: bodyText, onChange: (e) => setBodyText(e.target.value), placeholder: '{"key": "value"}' }), bodyError && _jsx("div", { className: "text-xs text-rose-600 mt-1", children: bodyError })] })), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsxs("button", { type: "button", className: "btn-primary inline-flex items-center gap-2", onClick: execute, disabled: tryMut.isPending, children: [_jsx(Play, { className: "w-4 h-4" }), tryMut.isPending ? "Executing…" : "Execute"] }), _jsxs("button", { type: "button", className: "btn-ghost inline-flex items-center gap-1 text-xs", onClick: () => {
                                    navigator.clipboard.writeText(curlSnippet(ep.method, fullUrl, buildHeaders(), queryVals, bodyText));
                                }, title: "Copy curl", children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy as curl"] }), _jsxs("button", { type: "button", className: "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30", onClick: () => setShowAiModal(true), title: "Auto-generate positive, negative, boundary and edge-case tests with assertions", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), "Generate AI Tests"] })] }), resp && (_jsxs("div", { className: "rounded border border-slate-200 dark:border-slate-700 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-xs font-mono font-bold ${statusTone(resp.status)}`, children: resp.status || "ERR" }), _jsxs("span", { className: "text-xs text-slate-500", children: [resp.elapsed_ms, " ms"] }), resp.error && _jsx("span", { className: "text-xs text-rose-600", children: resp.error })] }), _jsx("span", { className: "text-[11px] text-slate-400 font-mono", children: resp.content_type })] }), _jsxs("details", { className: "px-3 py-2 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("summary", { className: "text-xs text-slate-500 cursor-pointer", children: ["Headers (", Object.keys(resp.headers).length, ")"] }), _jsx("pre", { className: "mt-2 text-[11px] font-mono whitespace-pre-wrap text-slate-600 dark:text-slate-300", children: Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`).join("\n") })] }), _jsx("pre", { className: "bg-slate-950 text-emerald-300 text-[12px] font-mono p-3 overflow-auto max-h-96", children: prettify(resp.body, resp.content_type) || "(empty body)" })] })), Object.keys(ep.responses || {}).length > 0 && (_jsxs("details", { children: [_jsxs("summary", { className: "text-xs text-slate-500 cursor-pointer", children: ["Documented responses (", Object.keys(ep.responses).length, ")"] }), _jsx("ul", { className: "mt-2 space-y-1", children: Object.entries(ep.responses).map(([code, def]) => (_jsxs("li", { className: "text-xs", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded font-mono mr-2 ${statusTone(Number(code) || 0)}`, children: code }), _jsx("span", { className: "text-slate-600 dark:text-slate-300", children: def?.description || "" })] }, code))) })] }))] })), showAiModal && (_jsx(AiTestGeneratorModal, { endpointId: ep.id, method: ep.method, path: ep.path, baseUrl: serverUrl, onClose: () => setShowAiModal(false) }))] }));
}
function ParamSection({ title, params, values, onChange, }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: title }), _jsx("div", { className: "space-y-2 mt-2", children: params.map((p) => (_jsxs("div", { className: "grid grid-cols-[200px_1fr] gap-2 items-start", children: [_jsxs("div", { className: "text-xs pt-2", children: [_jsx("code", { className: "font-mono", children: p.name }), p.required && _jsx("span", { className: "text-rose-500 ml-1", children: "*" }), _jsx("div", { className: "text-[10px] text-slate-400", children: p.schema?.type || "string" })] }), _jsxs("div", { children: [p.schema?.enum?.length ? (_jsxs("select", { className: "input", value: values[p.name] ?? "", onChange: (e) => onChange({ ...values, [p.name]: e.target.value }), children: [_jsx("option", { value: "", children: "\u2014 select \u2014" }), p.schema.enum.map((opt) => (_jsx("option", { value: opt, children: opt }, opt)))] })) : (_jsx("input", { className: "input", placeholder: p.description || String(p.example ?? p.schema?.example ?? ""), value: values[p.name] ?? "", onChange: (e) => onChange({ ...values, [p.name]: e.target.value }) })), p.description && (_jsx("div", { className: "text-[11px] text-slate-500 mt-1", children: p.description }))] })] }, p.name))) })] }));
}
function curlSnippet(method, url, headers, query, body) {
    const q = Object.entries(query)
        .filter(([, v]) => v)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    const fullUrl = q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url;
    const parts = [`curl -X ${method.toUpperCase()} '${fullUrl}'`];
    for (const [k, v] of Object.entries(headers)) {
        parts.push(`  -H '${k}: ${v.replace(/'/g, "'\\''")}'`);
    }
    if (body.trim() && !["GET", "HEAD"].includes(method.toUpperCase())) {
        parts.push(`  -H 'Content-Type: application/json'`);
        parts.push(`  --data '${body.replace(/'/g, "'\\''")}'`);
    }
    return parts.join(" \\\n");
}
// --- Spec viewer (full page) ----------------------------------------------
function SpecViewer({ specId, onClose }) {
    const [filter, setFilter] = useState("");
    const { data, isLoading } = useQuery({
        queryKey: ["spec", specId],
        queryFn: async () => (await api.get(`/swagger/${specId}`)).data,
    });
    const eps = (data?.endpoints ?? []).filter((e) => {
        if (!filter)
            return true;
        const f = filter.toLowerCase();
        return (e.path.toLowerCase().includes(f) ||
            e.method.toLowerCase().includes(f) ||
            (e.summary || "").toLowerCase().includes(f) ||
            e.tags.some((t) => t.toLowerCase().includes(f)));
    });
    const groups = eps.reduce((acc, e) => {
        const key = e.tags[0] || "untagged";
        (acc[key] ||= []).push(e);
        return acc;
    }, {});
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("h2", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(Globe, { className: "w-5 h-5 text-sky-500" }), data?.name ?? "Loading…"] }), data && (_jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: ["v", data.version, " \u00B7 OpenAPI ", data.openapi_version, " \u00B7 ", data.endpoint_count, " endpoints", data.servers?.length ? ` · ${data.servers.length} server(s)` : ""] })), data?.description && (_jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl line-clamp-2", children: data.description }))] }), _jsx("button", { className: "btn-ghost", onClick: onClose, children: "\u2715" })] }), _jsx("div", { className: "p-4 border-b border-slate-200 dark:border-slate-800", children: _jsx("input", { className: "input", placeholder: "Filter by method, path, summary, or tag\u2026", value: filter, onChange: (e) => setFilter(e.target.value) }) }), _jsxs("div", { className: "overflow-auto p-4 space-y-6 flex-1", children: [isLoading && _jsx("div", { className: "text-sm text-slate-500", children: "Loading endpoints\u2026" }), !isLoading && eps.length === 0 && (_jsx("div", { className: "text-sm text-slate-500", children: "No endpoints match." })), Object.entries(groups).map(([tag, items]) => (_jsxs("div", { children: [_jsxs("h3", { className: "text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2", children: [tag, " ", _jsxs("span", { className: "text-slate-400", children: ["(", items.length, ")"] })] }), _jsx("div", { className: "space-y-2", children: items.map((e) => (_jsx(EndpointRow, { ep: e, servers: data?.servers ?? [] }, e.id))) })] }, tag)))] })] }) }));
}
// --- Presets / main page ---------------------------------------------------
const ZPE_PRESETS = [
    { label: "ZPECloud QA — User API", url: "https://api.qa-zpecloud.com/cloud-user-redoc", name: "ZPECloud User API (QA)" },
    { label: "ZPECloud QA — Device / Site Manage API", url: "https://api.qa-zpecloud.com/cloud-site-manage-redoc", name: "ZPECloud Device API (QA)" },
];
const LOGIN_PRESETS = [
    { label: "QA", url: "https://api.qa-zpecloud.com/user/auth" },
    { label: "Staging", url: "https://api.staging-zpecloud.com/user/auth" },
    { label: "Prod", url: "https://api.zpecloud.com/user/auth" },
];
function extractToken(body) {
    try {
        const parsed = JSON.parse(body);
        return (parsed?.access_token ||
            parsed?.accessToken ||
            parsed?.token ||
            parsed?.jwt ||
            parsed?.id_token ||
            parsed?.data?.access_token ||
            parsed?.data?.token ||
            null);
    }
    catch {
        return null;
    }
}
function fetchOAuthTokenPayload(args) {
    const { tokenUrl, grant, clientId, clientSecret, scope, username, password, clientAuth } = args;
    if (grant === "manual")
        return Promise.reject(new Error("Paste a token or choose a grant type"));
    if (!tokenUrl.trim())
        return Promise.reject(new Error("Token URL is required"));
    const form = new URLSearchParams();
    form.set("grant_type", grant);
    if (scope.trim())
        form.set("scope", scope.trim());
    if (grant === "password") {
        if (!username.trim())
            return Promise.reject(new Error("Username is required for password grant"));
        if (!password.trim())
            return Promise.reject(new Error("Password is required for password grant"));
        form.set("username", username.trim());
        form.set("password", password.trim());
    }
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
    };
    if (clientAuth === "basic" && clientId.trim()) {
        headers.Authorization = `Basic ${btoa(`${clientId.trim()}:${clientSecret}`)}`;
    }
    else if (clientAuth === "body" && clientId.trim()) {
        form.set("client_id", clientId.trim());
        if (clientSecret.trim())
            form.set("client_secret", clientSecret.trim());
    }
    return fetch(tokenUrl.trim(), {
        method: "POST",
        headers,
        body: form.toString(),
    }).then(async (res) => {
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        }
        if (!res.ok) {
            throw new Error(data?.error_description || data?.error || `HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        if (!data.access_token) {
            throw new Error("Response did not contain access_token");
        }
        return `${data.token_type || "Bearer"} ${data.access_token}`.trim();
    });
}
function OAuthAccessPanel({ onToken, defaultTokenUrl, }) {
    const [grant, setGrant] = useState("client_credentials");
    const [tokenUrl, setTokenUrl] = useState(defaultTokenUrl);
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [scope, setScope] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [clientAuth, setClientAuth] = useState("basic");
    const [showSecret, setShowSecret] = useState(false);
    const [busy, setBusy] = useState(false);
    const [info, setInfo] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
        if (defaultTokenUrl)
            setTokenUrl(defaultTokenUrl);
    }, [defaultTokenUrl]);
    const fetchToken = async () => {
        setInfo(null);
        setErr(null);
        setBusy(true);
        try {
            const token = await fetchOAuthTokenPayload({
                tokenUrl,
                grant,
                clientId,
                clientSecret,
                scope,
                username,
                password,
                clientAuth,
            });
            onToken(token.replace(/^Bearer\s+/i, ""));
            setInfo("✓ OAuth access token saved for API requests below");
        }
        catch (e) {
            setErr(e?.message || "Failed to fetch OAuth token");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "rounded-lg border border-violet-200 dark:border-violet-900/70 bg-violet-50/60 dark:bg-violet-950/20 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 flex-wrap", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300", children: "OAuth 2.0 access token" }), _jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "Fetch a bearer token from your provider and reuse it for every API request." })] }), _jsx("span", { className: "text-[11px] text-violet-700 dark:text-violet-300 font-mono", children: "stored in zpe-cloud-auth" })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Grant" }), _jsxs("select", { className: "input h-8 text-xs flex-1", value: grant, onChange: (e) => setGrant(e.target.value), children: [_jsx("option", { value: "client_credentials", children: "Client Credentials" }), _jsx("option", { value: "password", children: "Password Credentials" }), _jsx("option", { value: "manual", children: "Paste access token" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Header prefix" }), _jsx("input", { className: "input text-xs flex-1", value: "Bearer", readOnly: true })] })] }), grant !== "manual" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Token URL" }), _jsx("input", { className: "input text-xs flex-1", placeholder: "https://idp.example.com/oauth/token", value: tokenUrl, onChange: (e) => setTokenUrl(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Client ID" }), _jsx("input", { className: "input text-xs flex-1", value: clientId, onChange: (e) => setClientId(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Client Secret" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showSecret ? "text" : "password", value: clientSecret, onChange: (e) => setClientSecret(e.target.value) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowSecret((v) => !v), children: showSecret ? "Hide" : "Show" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Send creds" }), _jsxs("select", { className: "input h-8 text-xs flex-1", value: clientAuth, onChange: (e) => setClientAuth(e.target.value), children: [_jsx("option", { value: "basic", children: "Basic Auth header" }), _jsx("option", { value: "body", children: "In request body" })] })] }), grant === "password" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Username" }), _jsx("input", { className: "input text-xs flex-1", value: username, onChange: (e) => setUsername(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Password" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showSecret ? "text" : "password", value: password, onChange: (e) => setPassword(e.target.value) })] })] })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Scope" }), _jsx("input", { className: "input text-xs flex-1", placeholder: "read:users write:users", value: scope, onChange: (e) => setScope(e.target.value) })] })] })), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("button", { type: "button", className: "btn-ghost text-xs", disabled: busy, onClick: fetchToken, children: busy ? "Fetching…" : grant === "manual" ? "Validate token workflow" : "Get access token" }), info && _jsx("span", { className: "text-[11px] text-emerald-600", children: info }), err && _jsx("span", { className: "text-[11px] text-rose-600", children: err })] })] }));
}
function tokenizeCurlCommand(input) {
    const source = input.replace(/\\\r?\n/g, " ").trim();
    const tokens = [];
    let current = "";
    let quote = null;
    let escaped = false;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }
        if (quote) {
            if (quote === '"' && ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) {
                quote = null;
                continue;
            }
            current += ch;
            continue;
        }
        if (ch === "'" || ch === '"') {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            if (current) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        if (ch === "\\") {
            escaped = true;
            continue;
        }
        current += ch;
    }
    if (current)
        tokens.push(current);
    return tokens;
}
function parseCurlCommand(input) {
    const tokens = tokenizeCurlCommand(input);
    if (!tokens.length)
        throw new Error("Paste a curl command first");
    if (/^curl(\.exe)?$/i.test(tokens[0]))
        tokens.shift();
    if (!tokens.length)
        throw new Error("Paste a curl command first");
    let method = "GET";
    let url = "";
    const headers = {};
    const query = {};
    let body = null;
    let bodyKind = "none";
    let dataText = null;
    let getMode = false;
    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token === "-X" || token === "--request") {
            method = (tokens[++i] || "GET").toUpperCase();
            continue;
        }
        if (token === "-H" || token === "--header") {
            const header = tokens[++i] || "";
            const idx = header.indexOf(":");
            if (idx > 0) {
                const name = header.slice(0, idx).trim();
                const value = header.slice(idx + 1).trim();
                if (name && value)
                    headers[name] = value;
            }
            continue;
        }
        if (token === "-u" || token === "--user") {
            const userPass = tokens[++i] || "";
            if (userPass)
                headers.Authorization = `Basic ${btoa(userPass)}`;
            continue;
        }
        if (token === "-b" || token === "--cookie") {
            const cookie = tokens[++i] || "";
            if (cookie)
                headers.Cookie = cookie;
            continue;
        }
        if (token === "-G" || token === "--get") {
            getMode = true;
            method = "GET";
            continue;
        }
        if (token === "-I" || token === "--head") {
            method = "HEAD";
            continue;
        }
        if (token === "--json") {
            const raw = tokens[++i] || "";
            bodyKind = "json";
            method = method === "GET" ? "POST" : method;
            body = raw ? JSON.parse(raw) : null;
            headers["Content-Type"] = "application/json";
            continue;
        }
        if (token === "-d" || token === "--data" || token === "--data-raw" || token === "--data-binary" || token === "--data-ascii") {
            const raw = tokens[++i] || "";
            if (!raw)
                continue;
            if (raw.startsWith("@")) {
                throw new Error("curl file uploads like @file are not supported here");
            }
            dataText = raw;
            method = method === "GET" ? "POST" : method;
            continue;
        }
        if (token === "--url") {
            url = tokens[++i] || url;
            continue;
        }
        if (!token.startsWith("-") && !url) {
            url = token;
            continue;
        }
    }
    if (!url)
        throw new Error("curl command does not contain a URL");
    if (dataText !== null && bodyKind === "none") {
        const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] || "";
        const raw = dataText.trim();
        if (getMode) {
            const params = new URLSearchParams(raw);
            params.forEach((value, key) => {
                query[key] = value;
            });
            bodyKind = "none";
            body = null;
        }
        else if (/application\/x-www-form-urlencoded/i.test(contentType)) {
            const params = new URLSearchParams(raw);
            body = Object.fromEntries(params.entries());
            bodyKind = "form";
        }
        else {
            try {
                body = JSON.parse(raw);
                bodyKind = "json";
                if (!contentType)
                    headers["Content-Type"] = "application/json";
            }
            catch {
                body = raw;
                bodyKind = "text";
            }
        }
    }
    return { method, url, headers, query, body, bodyKind };
}
function QuickLoginCard() {
    const { selectedId } = useActiveEnv();
    const { data: envs } = useQuery({
        queryKey: ["envs-for-login"],
        queryFn: async () => (await api.get("/environments")).data,
        staleTime: 60_000,
    });
    const activeEnv = useMemo(() => envs?.find((e) => e.id === selectedId) ?? null, [envs, selectedId]);
    const { token, email, cookies, setToken, setEmail, setCookies, clear } = useZpeAuth();
    const [loginUrl, setLoginUrl] = useState(() => {
        if (activeEnv?.base_url)
            return activeEnv.base_url.replace(/\/$/, "") + "/user/auth";
        return LOGIN_PRESETS[0].url;
    });
    useEffect(() => {
        if (activeEnv?.base_url) {
            setLoginUrl(activeEnv.base_url.replace(/\/$/, "") + "/user/auth");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeEnv?.id]);
    const [pwd, setPwd] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [bodyText, setBodyText] = useState("");
    const [bodyError, setBodyError] = useState(null);
    const [curlText, setCurlText] = useState("");
    const [curlError, setCurlError] = useState(null);
    const [resp, setResp] = useState(null);
    const lastAutoRef = useRef("");
    // Keep JSON body in sync with email/password helpers (unless user edited manually)
    const autoBody = useMemo(() => JSON.stringify({ email, password: pwd || "••••" }, null, 2), [email, pwd]);
    useEffect(() => {
        if (!bodyText || bodyText === lastAutoRef.current) {
            setBodyText(autoBody);
            lastAutoRef.current = autoBody;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoBody]);
    const loginMut = useMutation({
        mutationFn: async (payload) => (await api.post("/swagger/try", payload)).data,
        onSuccess: (data) => {
            setResp(data);
            if (data.status >= 200 && data.status < 300) {
                const t = extractToken(data.body);
                if (t)
                    setToken(t);
                if (data.cookies && Object.keys(data.cookies).length) {
                    setCookies(data.cookies);
                }
            }
        },
        onError: (e) => setResp({
            status: 0,
            elapsed_ms: 0,
            headers: {},
            cookies: {},
            body: e?.response?.data?.error?.message ?? String(e),
            content_type: "",
            error: "request failed",
        }),
    });
    function submit() {
        setBodyError(null);
        let parsedBody;
        // Prefer the JSON textarea if user edited it; otherwise build from helpers.
        const raw = bodyText.trim() || JSON.stringify({ email, password: pwd });
        try {
            parsedBody = JSON.parse(raw);
        }
        catch {
            setBodyError("Body is not valid JSON");
            return;
        }
        // If they used the helper fields, ensure they win.
        if (email)
            parsedBody.email = email;
        if (pwd)
            parsedBody.password = pwd;
        loginMut.mutate({
            method: "POST",
            url: loginUrl,
            headers: { "Content-Type": "application/json" },
            body: parsedBody,
            body_kind: "json",
        });
    }
    function submitCurl() {
        setCurlError(null);
        try {
            const parsed = parseCurlCommand(curlText);
            loginMut.mutate({
                method: parsed.method,
                url: parsed.url,
                headers: parsed.headers,
                query: parsed.query,
                body: parsed.body,
                body_kind: parsed.bodyKind,
            });
        }
        catch (e) {
            setCurlError(e?.message || "Invalid curl command");
        }
    }
    return (_jsxs("div", { className: "card p-6 space-y-4 border-2 border-emerald-500/40", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(KeyRound, { className: "w-5 h-5 text-emerald-500" }), _jsxs("div", { children: [_jsx("h2", { className: "font-semibold", children: "Quick login (ZPE Cloud)" }), _jsxs("p", { className: "text-xs text-slate-500", children: ["POST to ", _jsx("code", { className: "font-mono", children: "/user/auth" }), ". Session cookies + token auto-attach to every endpoint below."] })] })] }), (token || Object.keys(cookies).length > 0) ? (_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), " Signed in"] }), Object.keys(cookies).length > 0 && (_jsxs("span", { className: "inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", title: Object.keys(cookies).join(", "), children: ["\uD83C\uDF6A ", Object.keys(cookies).length, " cookie", Object.keys(cookies).length === 1 ? "" : "s"] })), token && (_jsxs("button", { type: "button", className: "btn-ghost text-xs inline-flex items-center gap-1", onClick: () => navigator.clipboard.writeText(token), children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy token"] })), _jsxs("button", { type: "button", className: "btn-ghost text-xs text-rose-600 inline-flex items-center gap-1", onClick: clear, children: [_jsx(LogOut, { className: "w-3.5 h-3.5" }), " Clear"] })] })) : (_jsx("span", { className: "text-xs text-slate-400", children: "Not signed in" }))] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Login URL ", activeEnv && _jsxs("span", { className: "text-emerald-600", children: ["(env: ", activeEnv.name, ")"] })] }), _jsx("input", { className: "input mt-1", value: loginUrl, onChange: (e) => setLoginUrl(e.target.value) }), _jsx("div", { className: "flex gap-1 mt-2 flex-wrap", children: LOGIN_PRESETS.map((p) => (_jsx("button", { type: "button", className: "text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700", onClick: () => setLoginUrl(p.url), children: p.label }, p.url))) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Email" }), _jsx("input", { className: "input mt-1", type: "email", autoComplete: "username", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Password" }), _jsxs("div", { className: "flex gap-1 mt-1", children: [_jsx("input", { className: "input flex-1", type: showPwd ? "text" : "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: pwd, onChange: (e) => setPwd(e.target.value) }), _jsx("button", { type: "button", className: "btn-ghost text-xs", onClick: () => setShowPwd((v) => !v), children: showPwd ? "Hide" : "Show" })] })] })] })] }), _jsx(OAuthAccessPanel, { onToken: (token) => setToken(token), defaultTokenUrl: activeEnv?.base_url ? activeEnv.base_url.replace(/\/$/, "") + "/oauth/token" : "" }), _jsxs("div", { className: "rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/20 p-4 space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 flex-wrap", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300", children: "Execute curl command" }), _jsx("div", { className: "text-[11px] text-slate-500 mt-0.5", children: "Paste a curl command and run it through the same request proxy used by the API runner." })] }), _jsx("span", { className: "text-[11px] text-slate-500", children: "Supports common curl flags" })] }), _jsx("textarea", { className: "input mt-2 font-mono text-xs", rows: 6, value: curlText, onChange: (e) => setCurlText(e.target.value), placeholder: `curl -X POST 'https://api.example.com/items' \\
  -H 'Content-Type: application/json' \\
  --data '{"name":"demo"}'` }), curlError && _jsx("div", { className: "text-xs text-rose-600", children: curlError }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsxs("button", { type: "button", className: "btn-primary inline-flex items-center gap-2", onClick: submitCurl, disabled: loginMut.isPending || !curlText.trim(), children: [_jsx(Play, { className: "w-4 h-4" }), loginMut.isPending ? "Executing…" : "Run curl"] }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Flags: ", _jsx("code", { className: "font-mono", children: "-X" }), ", ", _jsx("code", { className: "font-mono", children: "-H" }), ", ", _jsx("code", { className: "font-mono", children: "-d" }), ", ", _jsx("code", { className: "font-mono", children: "--json" }), ", ", _jsx("code", { className: "font-mono", children: "-u" }), ", ", _jsx("code", { className: "font-mono", children: "-b" }), "."] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Request body (JSON)" }), _jsx("button", { type: "button", className: "text-xs text-indigo-600 hover:underline", onClick: () => {
                                    const next = JSON.stringify({ email, password: pwd }, null, 2);
                                    setBodyText(next);
                                    lastAutoRef.current = next;
                                }, children: "Sync from email + password" })] }), _jsx("textarea", { className: "input mt-2 font-mono text-xs", rows: 6, value: bodyText, onChange: (e) => setBodyText(e.target.value), placeholder: '{"email":"you@example.com","password":"\u2026"}' }), bodyError && _jsx("div", { className: "text-xs text-rose-600 mt-1", children: bodyError })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("button", { type: "button", className: "btn-primary inline-flex items-center gap-2", onClick: submit, disabled: loginMut.isPending, children: [_jsx(LogIn, { className: "w-4 h-4" }), loginMut.isPending ? "Signing in…" : "Login"] }), _jsxs("span", { className: "text-xs text-slate-500", children: ["Credentials never leave your browser except in this POST. Token is stored in localStorage as ", _jsx("code", { children: "zpe-cloud-auth" }), "."] })] }), resp && (_jsxs("div", { className: "rounded border border-slate-200 dark:border-slate-700 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-xs font-mono font-bold ${statusTone(resp.status)}`, children: resp.status || "ERR" }), _jsxs("span", { className: "text-xs text-slate-500", children: [resp.elapsed_ms, " ms"] }), resp.error && _jsx("span", { className: "text-xs text-rose-600", children: resp.error })] }), _jsx("span", { className: "text-[11px] text-slate-400 font-mono", children: resp.content_type })] }), resp.status >= 200 && resp.status < 300 && (extractToken(resp.body) || (resp.cookies && Object.keys(resp.cookies).length > 0)) && (_jsxs("div", { className: "px-3 py-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800 space-y-1", children: [extractToken(resp.body) && (_jsx("div", { children: "\u2713 Token saved \u2014 every endpoint's Bearer field below will use it." })), resp.cookies && Object.keys(resp.cookies).length > 0 && (_jsxs("div", { children: ["\uD83C\uDF6A Cookies captured: ", _jsx("code", { className: "font-mono", children: Object.keys(resp.cookies).join(", ") }), " \u2014 auto-attached to all requests below."] }))] })), _jsx("pre", { className: "bg-slate-950 text-emerald-300 text-[12px] font-mono p-3 overflow-auto max-h-72", children: prettify(resp.body, resp.content_type) || "(empty body)" })] }))] }));
}
export default function SwaggerUpload() {
    const qc = useQueryClient();
    const fileRef = useRef(null);
    const [msg, setMsg] = useState(null);
    const [url, setUrl] = useState("");
    const [urlName, setUrlName] = useState("");
    const { data: specs } = useQuery({
        queryKey: ["specs"],
        queryFn: async () => (await api.get("/swagger")).data,
    });
    const upload = useMutation({
        mutationFn: async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            return (await api.post("/swagger/upload", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
        },
        onSuccess: () => {
            setMsg("Upload successful");
            qc.invalidateQueries({ queryKey: ["specs"] });
        },
        onError: (e) => setMsg(e?.response?.data?.error?.message ?? "Upload failed"),
    });
    const importUrl = useMutation({
        mutationFn: async (payload) => (await api.post("/swagger/import-url", payload)).data,
        onSuccess: () => {
            setMsg("Imported from URL");
            setUrl("");
            setUrlName("");
            qc.invalidateQueries({ queryKey: ["specs"] });
        },
        onError: (e) => setMsg(e?.response?.data?.error?.message ?? "Import failed"),
    });
    const remove = useMutation({
        mutationFn: async (id) => api.delete(`/swagger/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["specs"] }),
    });
    const [viewing, setViewing] = useState(null);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "h-title", children: "API documentation" }), _jsx("p", { className: "text-sm text-slate-500 mt-1", children: "Upload an OpenAPI / Swagger spec, then explore endpoints with a built-in Try-it-out console \u2014 fill in URL, headers, body, and execute live requests." })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "card p-6 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Upload, { className: "w-4 h-4 text-indigo-500" }), _jsx("h2", { className: "font-semibold", children: "Upload a spec file" })] }), _jsx("p", { className: "text-sm text-slate-500", children: "OpenAPI 2.0 / 3.x JSON or YAML." }), _jsx("input", { ref: fileRef, type: "file", accept: ".json,.yml,.yaml", className: "input" }), _jsxs("button", { className: "btn-primary inline-flex items-center gap-2", onClick: () => {
                                    const f = fileRef.current?.files?.[0];
                                    if (f)
                                        upload.mutate(f);
                                }, disabled: upload.isPending, children: [_jsx(Upload, { className: "w-4 h-4" }), upload.isPending ? "Uploading…" : "Upload spec"] }), msg && _jsx("div", { className: "text-sm text-emerald-600", children: msg })] }), _jsxs("div", { className: "card p-6 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(LinkIcon, { className: "w-4 h-4 text-indigo-500" }), _jsx("h2", { className: "font-semibold", children: "Import from URL" })] }), _jsx("p", { className: "text-sm text-slate-500", children: "Paste a Swagger/OpenAPI JSON, YAML, or ReDoc page URL. The dashboard auto-discovers the underlying spec." }), _jsx("div", { className: "flex flex-wrap gap-2", children: ZPE_PRESETS.map((p) => (_jsxs("div", { className: "inline-flex items-stretch rounded-md overflow-hidden shadow-sm ring-1 ring-slate-200 dark:ring-slate-700", children: [_jsx("button", { className: "px-3 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200", type: "button", onClick: () => {
                                                setUrl(p.url);
                                                setUrlName(p.name);
                                            }, children: p.label }), _jsxs("a", { href: p.url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white", children: [_jsx(ExternalLink, { className: "w-3.5 h-3.5" }), "Open"] })] }, p.url))) }), _jsx("input", { className: "input", placeholder: "https://api.example.com/openapi.json or .../redoc", value: url, onChange: (e) => setUrl(e.target.value) }), _jsx("input", { className: "input", placeholder: "Optional display name", value: urlName, onChange: (e) => setUrlName(e.target.value) }), _jsx("button", { className: "btn-primary", disabled: !url || importUrl.isPending, onClick: () => importUrl.mutate({ url, name: urlName || undefined }), children: importUrl.isPending ? "Importing…" : "Import from URL" })] })] }), _jsx(QuickLoginCard, {}), _jsx("div", { className: "card", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2", children: "Name" }), _jsx("th", { children: "Version" }), _jsx("th", { children: "OpenAPI" }), _jsx("th", { children: "Endpoints" }), _jsx("th", { children: "Uploaded" }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [specs?.map((s) => (_jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800", children: [_jsx("td", { className: "px-4 py-2 font-medium", children: s.name }), _jsx("td", { children: s.version }), _jsx("td", { children: s.openapi_version }), _jsx("td", { children: s.endpoint_count }), _jsx("td", { children: new Date(s.created_at).toLocaleString() }), _jsxs("td", { className: "space-x-2 pr-4 text-right", children: [_jsx("button", { className: "btn-primary text-xs", onClick: () => setViewing(s.id), children: "Explore" }), _jsx("button", { className: "btn-ghost text-rose-600 text-xs", onClick: () => remove.mutate(s.id), children: "Delete" })] })] }, s.id))), !specs?.length && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "text-center p-6 text-slate-500", children: "No specs uploaded yet." }) }))] })] }) }), viewing && _jsx(SpecViewer, { specId: viewing, onClose: () => setViewing(null) })] }));
}
