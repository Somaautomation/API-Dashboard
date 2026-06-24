import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
function safeParseJson(text, fallback) {
    const trimmed = text.trim();
    if (!trimmed)
        return fallback;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        throw new Error("Invalid JSON");
    }
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
        catch { /* noop */ }
    }
    return body;
}
function RunResults({ result }) {
    const [openIdx, setOpenIdx] = useState(0);
    const items = result.summary?.items ?? [];
    return (_jsxs("div", { className: "mt-3 border border-slate-200 dark:border-slate-700 rounded-md", children: [_jsxs("div", { className: "px-3 py-2 flex items-center gap-2 text-xs border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40", children: [_jsx("span", { className: `badge px-1.5 py-0.5 font-bold ${result.status === "passed" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`, children: result.status }), _jsxs("span", { className: "font-medium", children: [result.passed, "/", result.total, " passed"] }), _jsxs("span", { className: "text-slate-500", children: ["\u00B7 ", result.duration_ms, " ms"] }), _jsx("span", { className: "text-slate-400 font-mono ml-auto truncate", title: result.id, children: result.id.slice(0, 8) })] }), items.length === 0 && (_jsx("div", { className: "p-3 text-xs text-slate-500 italic", children: "No per-request data captured." })), _jsx("div", { className: "divide-y divide-slate-100 dark:divide-slate-800", children: items.map((it, i) => {
                    const open = openIdx === i;
                    return (_jsxs("div", { children: [_jsxs("button", { className: "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40", onClick: () => setOpenIdx(open ? null : i), children: [_jsx("span", { className: "text-slate-400 text-xs w-4", children: open ? "▾" : "▸" }), _jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method || "?")}`, children: it.method || "?" }), it.error ? (_jsx("span", { className: "badge px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", children: "ERR" })) : (_jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${statusCodeColor(it.status_code)}`, children: it.status_code })), _jsx("span", { className: "text-xs font-medium truncate", children: it.name }), _jsxs("span", { className: "text-[11px] text-slate-500 whitespace-nowrap ml-auto", children: [it.duration_ms ?? 0, " ms"] })] }), open && (_jsxs("div", { className: "px-3 pb-3 space-y-2 bg-slate-50/60 dark:bg-slate-900/30", children: [_jsx("div", { className: "text-[11px] font-mono text-slate-500 break-all", children: it.url }), it.error && (_jsx("div", { className: "text-xs text-red-600 font-mono whitespace-pre-wrap break-all", children: it.error })), it.response_headers && Object.keys(it.response_headers).length > 0 && (_jsxs("details", { className: "text-xs", children: [_jsxs("summary", { className: "cursor-pointer text-slate-500", children: ["Headers (", Object.keys(it.response_headers).length, ")"] }), _jsx("pre", { className: "mt-1 p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px] overflow-auto max-h-40", children: Object.entries(it.response_headers).map(([k, v]) => `${k}: ${v}`).join("\n") })] })), it.response_body !== undefined && (_jsxs("details", { open: true, className: "text-xs", children: [_jsxs("summary", { className: "cursor-pointer text-slate-500", children: ["Body", it.response_size !== undefined && (_jsxs("span", { className: "text-slate-400", children: [" (", it.response_size, " bytes", it.response_truncated ? ", truncated" : "", ")"] }))] }), _jsx("pre", { className: "mt-1 p-2 rounded bg-slate-900 text-slate-100 text-[11px] overflow-auto max-h-72 whitespace-pre-wrap break-all", children: prettyBody(it.response_body) || "(empty)" })] }))] }))] }, i));
                }) })] }));
}
const DEFAULT_AUTH = {
    type: "none",
    token: "",
    apiKeyName: "X-API-Key",
    apiKeyValue: "",
    apiKeyIn: "header",
    basicUser: "",
    basicPass: "",
    oauthGrant: "client_credentials",
    oauthTokenUrl: "",
    oauthClientId: "",
    oauthClientSecret: "",
    oauthScope: "",
    oauthUsername: "",
    oauthPassword: "",
    oauthClientAuth: "basic",
    oauthHeaderPrefix: "Bearer",
};
const AUTH_HEADER_KEYS = ["authorization", "Authorization"];
function findHeader(obj, name) {
    const lower = name.toLowerCase();
    for (const k of Object.keys(obj))
        if (k.toLowerCase() === lower)
            return obj[k];
    return undefined;
}
function detectAuth(headers, query) {
    const h = { ...headers };
    const q = { ...query };
    const authHeader = findHeader(h, "Authorization");
    let auth = { ...DEFAULT_AUTH };
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
        auth.type = "bearer";
        auth.token = authHeader.replace(/^Bearer\s+/i, "").trim();
        for (const k of AUTH_HEADER_KEYS)
            delete h[k];
    }
    else if (authHeader && /^Basic\s+/i.test(authHeader)) {
        try {
            const decoded = atob(authHeader.replace(/^Basic\s+/i, "").trim());
            const [u, ...rest] = decoded.split(":");
            auth.type = "basic";
            auth.basicUser = u || "";
            auth.basicPass = rest.join(":");
        }
        catch {
            /* leave as raw header */
        }
        for (const k of AUTH_HEADER_KEYS)
            delete h[k];
    }
    else {
        // Detect api-key style headers (X-API-Key, x-api-key, apikey, api-key)
        const apiKeyKey = Object.keys(h).find((k) => /^(x-api-key|api-key|apikey)$/i.test(k));
        if (apiKeyKey) {
            auth.type = "apikey";
            auth.apiKeyIn = "header";
            auth.apiKeyName = apiKeyKey;
            auth.apiKeyValue = h[apiKeyKey];
            delete h[apiKeyKey];
        }
        else {
            const apiKeyQ = Object.keys(q).find((k) => /^(api_?key|apikey)$/i.test(k));
            if (apiKeyQ) {
                auth.type = "apikey";
                auth.apiKeyIn = "query";
                auth.apiKeyName = apiKeyQ;
                auth.apiKeyValue = q[apiKeyQ];
                delete q[apiKeyQ];
            }
        }
    }
    return { auth, strippedHeaders: h, strippedQuery: q };
}
function applyAuth(headers, query, auth) {
    const h = { ...headers };
    const q = { ...query };
    // strip any existing auth artifacts first
    for (const k of Object.keys(h)) {
        if (k.toLowerCase() === "authorization")
            delete h[k];
        if (/^(x-api-key|api-key|apikey)$/i.test(k))
            delete h[k];
    }
    for (const k of Object.keys(q)) {
        if (/^(api_?key|apikey)$/i.test(k))
            delete q[k];
    }
    if (auth.type === "bearer" && auth.token.trim()) {
        h["Authorization"] = `Bearer ${auth.token.trim()}`;
    }
    else if (auth.type === "oauth2" && auth.token.trim()) {
        const prefix = (auth.oauthHeaderPrefix || "Bearer").trim();
        h["Authorization"] = `${prefix} ${auth.token.trim()}`;
    }
    else if (auth.type === "basic" && (auth.basicUser || auth.basicPass)) {
        const enc = btoa(`${auth.basicUser}:${auth.basicPass}`);
        h["Authorization"] = `Basic ${enc}`;
    }
    else if (auth.type === "apikey" && auth.apiKeyName && auth.apiKeyValue) {
        if (auth.apiKeyIn === "header")
            h[auth.apiKeyName] = auth.apiKeyValue;
        else
            q[auth.apiKeyName] = auth.apiKeyValue;
    }
    return { headers: h, query: q };
}
function OAuth2Panel({ auth, setAuth, showToken, setShowToken, }) {
    const [fetching, setFetching] = useState(false);
    const [fetchErr, setFetchErr] = useState(null);
    const [fetchInfo, setFetchInfo] = useState(null);
    const fetchToken = async () => {
        setFetchErr(null);
        setFetchInfo(null);
        if (auth.oauthGrant === "manual")
            return;
        if (!auth.oauthTokenUrl) {
            setFetchErr("Token URL is required");
            return;
        }
        setFetching(true);
        try {
            const form = new URLSearchParams();
            form.set("grant_type", auth.oauthGrant);
            if (auth.oauthScope)
                form.set("scope", auth.oauthScope);
            if (auth.oauthGrant === "password") {
                form.set("username", auth.oauthUsername);
                form.set("password", auth.oauthPassword);
            }
            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            };
            if (auth.oauthClientAuth === "basic" && auth.oauthClientId) {
                headers["Authorization"] =
                    "Basic " + btoa(`${auth.oauthClientId}:${auth.oauthClientSecret}`);
            }
            else if (auth.oauthClientAuth === "body" && auth.oauthClientId) {
                form.set("client_id", auth.oauthClientId);
                if (auth.oauthClientSecret)
                    form.set("client_secret", auth.oauthClientSecret);
            }
            const res = await fetch(auth.oauthTokenUrl, {
                method: "POST",
                headers,
                body: form.toString(),
            });
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
            setAuth({ ...auth, token: data.access_token });
            const expiresIn = data.expires_in ? `, expires in ${data.expires_in}s` : "";
            setFetchInfo(`✓ token received (${data.token_type || "Bearer"}${expiresIn})`);
        }
        catch (e) {
            setFetchErr(e?.message || "Failed to fetch token");
        }
        finally {
            setFetching(false);
        }
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Grant" }), _jsxs("select", { className: "input h-8 text-xs", value: auth.oauthGrant, onChange: (e) => setAuth({ ...auth, oauthGrant: e.target.value }), children: [_jsx("option", { value: "client_credentials", children: "Client Credentials" }), _jsx("option", { value: "password", children: "Password Credentials" }), _jsx("option", { value: "manual", children: "Paste access token" })] })] }), auth.oauthGrant !== "manual" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Token URL" }), _jsx("input", { className: "input text-xs flex-1", placeholder: "https://idp.example.com/oauth/token", value: auth.oauthTokenUrl, onChange: (e) => setAuth({ ...auth, oauthTokenUrl: e.target.value }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Client ID" }), _jsx("input", { className: "input text-xs flex-1", value: auth.oauthClientId, onChange: (e) => setAuth({ ...auth, oauthClientId: e.target.value }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Client Secret" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", value: auth.oauthClientSecret, onChange: (e) => setAuth({ ...auth, oauthClientSecret: e.target.value }) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowToken((s) => !s), children: showToken ? "Hide" : "Show" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Send creds" }), _jsxs("select", { className: "input h-8 text-xs", value: auth.oauthClientAuth, onChange: (e) => setAuth({
                                    ...auth,
                                    oauthClientAuth: e.target.value,
                                }), children: [_jsx("option", { value: "basic", children: "Basic Auth header" }), _jsx("option", { value: "body", children: "In request body" })] })] }), auth.oauthGrant === "password" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Username" }), _jsx("input", { className: "input text-xs flex-1", value: auth.oauthUsername, onChange: (e) => setAuth({ ...auth, oauthUsername: e.target.value }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Password" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", value: auth.oauthPassword, onChange: (e) => setAuth({ ...auth, oauthPassword: e.target.value }) })] })] })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Scope" }), _jsx("input", { className: "input text-xs flex-1", placeholder: "read:users write:users", value: auth.oauthScope, onChange: (e) => setAuth({ ...auth, oauthScope: e.target.value }) })] }), _jsxs("div", { children: [_jsx("button", { type: "button", className: "btn-ghost text-xs", disabled: fetching, onClick: fetchToken, children: fetching ? "Fetching…" : "Get access token" }), fetchInfo && (_jsx("span", { className: "ml-2 text-[11px] text-emerald-600", children: fetchInfo })), fetchErr && (_jsx("span", { className: "ml-2 text-[11px] text-rose-600", children: fetchErr }))] })] })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Access token" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", placeholder: "paste or fetch above", value: auth.token, onChange: (e) => setAuth({ ...auth, token: e.target.value }) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowToken((s) => !s), children: showToken ? "Hide" : "Show" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Header prefix" }), _jsx("input", { className: "input text-xs w-32", value: auth.oauthHeaderPrefix, onChange: (e) => setAuth({ ...auth, oauthHeaderPrefix: e.target.value }) }), _jsxs("span", { className: "text-[10px] text-slate-400", children: ["sends ", _jsxs("code", { children: ["Authorization: ", auth.oauthHeaderPrefix || "Bearer", " <token>"] })] })] })] }));
}
function RequestForm({ collectionId, existing, onDone, onCancel, }) {
    const isEdit = !!existing;
    const initialAssertion = existing?.assertions?.find((a) => a?.type === "status_code")?.expected ?? 200;
    const detected = detectAuth(existing?.headers ?? {}, existing?.query ?? {});
    const [name, setName] = useState(existing?.name ?? "");
    const [method, setMethod] = useState(existing?.method ?? "GET");
    const [url, setUrl] = useState(existing?.url ?? "");
    const [auth, setAuth] = useState(existing ? detected.auth : { ...DEFAULT_AUTH });
    const [headersText, setHeadersText] = useState(JSON.stringify(existing
        ? Object.keys(detected.strippedHeaders).length
            ? detected.strippedHeaders
            : { Accept: "application/json" }
        : { Accept: "application/json" }, null, 2));
    const [queryText, setQueryText] = useState(JSON.stringify(existing ? detected.strippedQuery : {}, null, 2));
    const [bodyText, setBodyText] = useState(existing?.body ? JSON.stringify(existing.body, null, 2) : "");
    const [expectedStatus, setExpectedStatus] = useState(Number(initialAssertion));
    const [showToken, setShowToken] = useState(false);
    const [err, setErr] = useState(null);
    const save = useMutation({
        mutationFn: async () => {
            setErr(null);
            const baseHeaders = safeParseJson(headersText, {});
            const baseQuery = safeParseJson(queryText, {});
            const merged = applyAuth(baseHeaders, baseQuery, auth);
            const payload = {
                name: name || `${method} ${url}`,
                method,
                url,
                headers: merged.headers,
                query: merged.query,
                body: bodyText.trim() ? safeParseJson(bodyText, null) : null,
                assertions: [{ type: "status_code", expected: Number(expectedStatus) }],
            };
            if (isEdit) {
                return (await api.put(`/collections/${collectionId}/items/${existing.id}`, payload)).data;
            }
            return (await api.post(`/collections/${collectionId}/items`, payload)).data;
        },
        onSuccess: () => {
            if (!isEdit) {
                setName("");
                setUrl("");
                setBodyText("");
            }
            onDone();
        },
        onError: (e) => setErr(e?.response?.data?.detail ?? e.message ?? "Failed"),
    });
    return (_jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 p-3 mt-2 space-y-2 bg-slate-50/60 dark:bg-slate-800/30", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-slate-600 dark:text-slate-300", children: isEdit ? "Edit request" : "Add request" }), onCancel && (_jsx("button", { className: "text-xs text-slate-500 hover:underline ml-auto", onClick: onCancel, children: "Cancel" }))] }), _jsxs("div", { className: "grid grid-cols-[100px_1fr] gap-2", children: [_jsx("select", { className: "input", value: method, onChange: (e) => setMethod(e.target.value), children: METHODS.map((m) => _jsx("option", { value: m, children: m }, m)) }), _jsx("input", { className: "input", placeholder: "https://api.qa-zpecloud.com/device", value: url, onChange: (e) => setUrl(e.target.value) })] }), _jsx("input", { className: "input", placeholder: "Name (optional)", value: name, onChange: (e) => setName(e.target.value) }), _jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 p-2 space-y-2 bg-white/60 dark:bg-slate-900/40", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Auth" }), _jsxs("select", { className: "input h-8 text-xs", value: auth.type, onChange: (e) => setAuth({ ...auth, type: e.target.value }), children: [_jsx("option", { value: "none", children: "No Auth" }), _jsx("option", { value: "bearer", children: "Bearer Token" }), _jsx("option", { value: "apikey", children: "API Key" }), _jsx("option", { value: "basic", children: "Basic Auth" }), _jsx("option", { value: "oauth2", children: "OAuth 2.0" })] }), _jsx("span", { className: "text-[10px] text-slate-400 ml-auto", children: "Saved into request headers on save" })] }), auth.type === "bearer" && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Token" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", placeholder: "zpe_cloud_EaJl4d...", value: auth.token, onChange: (e) => setAuth({ ...auth, token: e.target.value }) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowToken((s) => !s), children: showToken ? "Hide" : "Show" })] })), auth.type === "apikey" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Key" }), _jsx("input", { className: "input text-xs flex-1", placeholder: "X-API-Key", value: auth.apiKeyName, onChange: (e) => setAuth({ ...auth, apiKeyName: e.target.value }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Value" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", placeholder: "api key value", value: auth.apiKeyValue, onChange: (e) => setAuth({ ...auth, apiKeyValue: e.target.value }) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowToken((s) => !s), children: showToken ? "Hide" : "Show" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Add to" }), _jsxs("select", { className: "input h-8 text-xs", value: auth.apiKeyIn, onChange: (e) => setAuth({ ...auth, apiKeyIn: e.target.value }), children: [_jsx("option", { value: "header", children: "Header" }), _jsx("option", { value: "query", children: "Query Params" })] })] })] })), auth.type === "basic" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Username" }), _jsx("input", { className: "input text-xs flex-1", value: auth.basicUser, onChange: (e) => setAuth({ ...auth, basicUser: e.target.value }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500 w-20", children: "Password" }), _jsx("input", { className: "input font-mono text-xs flex-1", type: showToken ? "text" : "password", value: auth.basicPass, onChange: (e) => setAuth({ ...auth, basicPass: e.target.value }) }), _jsx("button", { type: "button", className: "text-[11px] text-slate-500 hover:underline", onClick: () => setShowToken((s) => !s), children: showToken ? "Hide" : "Show" })] })] })), auth.type === "oauth2" && (_jsx(OAuth2Panel, { auth: auth, setAuth: setAuth, showToken: showToken, setShowToken: setShowToken }))] }), _jsxs("div", { className: "grid sm:grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[11px] text-slate-500", children: "Headers (JSON)" }), _jsx("textarea", { className: "input font-mono text-xs h-20", value: headersText, onChange: (e) => setHeadersText(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[11px] text-slate-500", children: "Query (JSON)" }), _jsx("textarea", { className: "input font-mono text-xs h-20", value: queryText, onChange: (e) => setQueryText(e.target.value) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[11px] text-slate-500", children: "Body (JSON, leave empty for none)" }), _jsx("textarea", { className: "input font-mono text-xs h-24", placeholder: '{"key":"value"}', value: bodyText, onChange: (e) => setBodyText(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs text-slate-500", children: "Expect status" }), _jsx("input", { type: "number", className: "input w-24", value: expectedStatus, onChange: (e) => setExpectedStatus(Number(e.target.value)) }), _jsx("button", { className: "btn-primary ml-auto", disabled: !url || save.isPending, onClick: () => save.mutate(), children: save.isPending ? (isEdit ? "Saving…" : "Adding…") : (isEdit ? "Save" : "Add request") })] }), err && _jsx("div", { className: "text-xs text-red-600", children: err })] }));
}
function AddRequestForm({ collectionId, onAdded }) {
    return _jsx(RequestForm, { collectionId: collectionId, onDone: onAdded });
}
function ItemsList({ collection, onChanged, onItemResult, environmentId, }) {
    const [editingId, setEditingId] = useState(null);
    const [runningItemId, setRunningItemId] = useState(null);
    const del = useMutation({
        mutationFn: async (itemId) => api.delete(`/collections/${collection.id}/items/${itemId}`),
        onSuccess: () => {
            setEditingId(null);
            onChanged();
        },
    });
    const runItem = useMutation({
        mutationFn: async (itemId) => {
            const item = collection.items.find((i) => i.id === itemId);
            if (item && /\{\{[^}]+\}\}/.test(item.url) && !environmentId) {
                if (!confirm(`This URL contains template variables like {{baseUrl}} but no environment is selected.\n\n` +
                    `Pick an environment in the "Environment for runs" dropdown at the top.\n\n` +
                    `Run anyway (will likely fail)?`)) {
                    throw new Error("Cancelled: no environment selected for templated URL");
                }
            }
            setRunningItemId(itemId);
            try {
                const body = {
                    collection_id: collection.id,
                    item_id: itemId,
                    variables: {},
                };
                if (environmentId)
                    body.environment_id = environmentId;
                return (await api.post(`/runs/item`, body)).data;
            }
            finally {
                setRunningItemId(null);
            }
        },
        onSuccess: (r) => onItemResult(r),
        onError: (e) => alert(`Run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
    });
    if (collection.items.length === 0) {
        return _jsx("div", { className: "text-xs text-slate-500 italic", children: "No requests yet \u2014 add one below." });
    }
    const clearSession = async () => {
        try {
            await api.post(`/collections/${collection.id}/session/clear`);
            alert("Session cookies cleared. Next run starts fresh.");
        }
        catch (e) {
            alert(`Failed: ${e?.response?.data?.detail ?? e.message}`);
        }
    };
    return (_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "flex items-center justify-end", children: _jsx("button", { className: "text-[11px] text-slate-500 hover:text-rose-600 hover:underline", onClick: clearSession, title: "Clear cached login cookies for this collection", children: "Reset session" }) }), _jsx("ul", { className: "text-xs divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-md", children: collection.items.map((it) => {
                    const isEditing = editingId === it.id;
                    return (_jsxs("li", { className: "px-2 py-1.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${methodColor(it.method)}`, children: it.method }), _jsx("span", { className: "font-medium truncate", title: it.name, children: it.name }), _jsx("span", { className: "font-mono text-slate-500 truncate flex-1", title: it.url, children: it.url }), _jsx("button", { className: "text-sky-600 hover:underline text-[11px]", disabled: runningItemId === it.id, onClick: () => runItem.mutate(it.id), title: "Run only this request", children: runningItemId === it.id ? "Running…" : "Run" }), _jsx("button", { className: "text-slate-600 dark:text-slate-300 hover:underline text-[11px]", onClick: () => setEditingId(isEditing ? null : it.id), title: "Edit this request", children: isEditing ? "Close" : "Edit" }), _jsx("button", { className: "text-rose-600 hover:underline text-[11px]", disabled: del.isPending, onClick: () => {
                                            if (confirm(`Delete request "${it.name}"?`))
                                                del.mutate(it.id);
                                        }, title: "Remove this request", children: "\u2715" })] }), isEditing && (_jsx(RequestForm, { collectionId: collection.id, existing: it, onCancel: () => setEditingId(null), onDone: () => {
                                    setEditingId(null);
                                    onChanged();
                                } }))] }, it.id));
                }) })] }));
}
export default function Collections() {
    const qc = useQueryClient();
    const [specId, setSpecId] = useState("");
    const [openId, setOpenId] = useState(null);
    const [results, setResults] = useState({});
    const [runningId, setRunningId] = useState(null);
    const [envId, setEnvId] = useState(() => localStorage.getItem("collections.envId") || "");
    useEffect(() => {
        localStorage.setItem("collections.envId", envId);
    }, [envId]);
    const { data: cols } = useQuery({
        queryKey: ["cols"],
        queryFn: async () => (await api.get("/collections")).data,
    });
    const { data: specs } = useQuery({
        queryKey: ["specs"],
        queryFn: async () => (await api.get("/swagger")).data,
    });
    const { data: envs } = useQuery({
        queryKey: ["envs"],
        queryFn: async () => (await api.get("/environments")).data,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
    });
    const generate = useMutation({
        mutationFn: async (id) => (await api.post(`/collections/from-spec/${id}`)).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
    });
    const del = useMutation({
        mutationFn: async (id) => api.delete(`/collections/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
    });
    const prependLogin = useMutation({
        mutationFn: async (vars) => (await api.post(`/collections/${vars.id}/prepend-login`, {
            email: vars.email,
            password: vars.password,
            login_path: vars.login_path,
        })).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
    });
    function onPrependLogin(id) {
        const email = prompt("Login email", "somashekar.rangaswamy@zpesystems.com");
        if (!email)
            return;
        const password = prompt("Password");
        if (!password)
            return;
        const login_path = prompt("Login path (relative to base URL)", "/user/auth") || "/user/auth";
        prependLogin.mutate({ id, email, password, login_path });
    }
    const run = useMutation({
        mutationFn: async (id) => {
            const c = cols?.find((x) => x.id === id);
            if (c && !envId && c.items.some((it) => /\{\{[^}]+\}\}/.test(it.url))) {
                if (!confirm(`Some requests use {{baseUrl}} or other template variables but no environment is selected.\n\n` +
                    `Pick an environment in the "Environment for runs" dropdown.\n\n` +
                    `Run anyway (those requests will likely fail)?`)) {
                    throw new Error("Cancelled: no environment selected for templated URLs");
                }
            }
            setRunningId(id);
            try {
                const body = { collection_id: id, variables: {} };
                if (envId)
                    body.environment_id = envId;
                const r = (await api.post(`/runs`, body)).data;
                return { id, result: r };
            }
            finally {
                setRunningId(null);
            }
        },
        onSuccess: ({ id, result }) => {
            setResults((prev) => ({ ...prev, [id]: result }));
            setOpenId(id);
        },
        onError: (e) => alert(`Run failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
    });
    const importPostman = useMutation({
        mutationFn: async (file) => {
            const form = new FormData();
            form.append("file", file);
            return (await api.post("/collections/import/postman", form, {
                headers: { "Content-Type": "multipart/form-data" },
            })).data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
        onError: (e) => alert(`Import failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`),
    });
    function onPickPostman(e) {
        const f = e.target.files?.[0];
        if (f)
            importPostman.mutate(f);
        e.target.value = "";
    }
    const sampleLogin = useMutation({
        mutationFn: async () => (await api.post("/collections", {
            name: "Sample: ZPECloud Login",
            description: "POST /user/auth against api.qa-zpecloud.com",
            tags: ["sample", "auth"],
            items: [
                {
                    name: "Login",
                    method: "POST",
                    url: "https://api.qa-zpecloud.com/user/auth",
                    headers: { "Content-Type": "application/json" },
                    query: {},
                    body: {
                        email: "somashekar.rangaswamy@zpesystems.com",
                        password: "Varchas@24",
                    },
                    assertions: [{ type: "status_code", expected: 200 }],
                },
            ],
        })).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cols"] }),
    });
    async function downloadExport(id, name, fmt) {
        try {
            const res = await api.get(`/collections/${id}/export`, {
                params: { fmt },
                responseType: "blob",
            });
            const cd = res.headers["content-disposition"];
            let filename = `${name || "collection"}.${fmt}`;
            const m = cd?.match(/filename="?([^"]+)"?/i);
            if (m)
                filename = m[1];
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            alert(`Export failed: ${e?.response?.status ?? ""} ${e?.response?.data?.detail ?? e.message}`);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Collections" }), _jsxs("div", { className: "card p-4 flex flex-wrap gap-2 items-end", children: [_jsxs("div", { className: "flex-1 min-w-[200px]", children: [_jsx("label", { className: "text-xs text-slate-500", children: "Generate from spec" }), _jsxs("select", { className: "input mt-1", value: specId, onChange: (e) => setSpecId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 pick a spec \u2014" }), specs?.map((s) => (_jsxs("option", { value: s.id, children: [s.name, " (", s.version, ")"] }, s.id)))] })] }), _jsxs("div", { className: "min-w-[200px]", children: [_jsxs("label", { className: "text-xs text-slate-500", children: ["Environment for runs", envId && envs?.find((e) => e.id === envId)?.base_url && (_jsxs("span", { className: "ml-1 font-mono text-[10px] text-emerald-600", children: [`{{baseUrl}}`, " \u2192 ", envs.find((e) => e.id === envId).base_url] }))] }), _jsxs("select", { className: "input mt-1", value: envId, onChange: (e) => setEnvId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 none (no variable substitution) \u2014" }), envs?.map((e) => (_jsx("option", { value: e.id, children: e.name }, e.id)))] })] }), _jsx("button", { className: "btn-primary", disabled: !specId || generate.isPending, onClick: () => generate.mutate(specId), children: "Generate" }), _jsxs("label", { className: "btn-ghost border border-slate-200 dark:border-slate-700 cursor-pointer", children: [importPostman.isPending ? "Importing…" : "Import Postman", _jsx("input", { type: "file", accept: ".json,application/json", className: "hidden", onChange: onPickPostman, disabled: importPostman.isPending })] }), _jsx("button", { className: "btn-ghost border border-slate-200 dark:border-slate-700", disabled: sampleLogin.isPending, onClick: () => sampleLogin.mutate(), title: "Create a sample collection with a POST login to api.qa-zpecloud.com", children: "+ ZPECloud login sample" })] }), _jsx("div", { className: "grid md:grid-cols-2 gap-4", children: cols?.map((c) => {
                    const isOpen = openId === c.id;
                    return (_jsxs("div", { className: "card p-4 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "font-semibold", children: c.name }), _jsxs("span", { className: "badge bg-slate-100 dark:bg-slate-800", children: [c.items.length, " items"] })] }), _jsx("p", { className: "text-sm text-slate-500", children: c.description || "—" }), _jsxs("div", { className: "flex flex-wrap gap-2 pt-2", children: [_jsx("button", { className: "btn-primary", disabled: runningId === c.id, onClick: () => run.mutate(c.id), children: runningId === c.id ? "Running…" : "Run" }), _jsx("button", { className: "btn-ghost border border-emerald-300 text-emerald-700 dark:text-emerald-300", disabled: prependLogin.isPending, onClick: () => onPrependLogin(c.id), title: "Insert a POST /user/auth login at position 0; subsequent items inherit its session cookie", children: prependLogin.isPending ? "Adding…" : "+ Login step" }), _jsx("button", { className: "btn-ghost border border-slate-200 dark:border-slate-700", onClick: () => setOpenId(isOpen ? null : c.id), children: isOpen ? "Hide requests" : `Manage requests (${c.items.length})` }), ["postman", "curl", "robot", "playwright", "k6"].map((f) => (_jsx("button", { className: "btn-ghost border border-slate-200 dark:border-slate-700", onClick: () => downloadExport(c.id, c.name, f), title: `Download as ${f}`, children: f }, f))), _jsx("button", { className: "btn-ghost text-red-600 ml-auto", onClick: () => del.mutate(c.id), children: "Delete" })] }), isOpen && (_jsxs("div", { className: "pt-2 space-y-2", children: [_jsx("div", { className: "text-[11px] text-slate-500", children: envId && envs?.find((e) => e.id === envId) ? (_jsxs(_Fragment, { children: ["Using env ", _jsx("b", { children: envs.find((e) => e.id === envId).name }), envs.find((e) => e.id === envId).base_url && (_jsxs(_Fragment, { children: [" ", "\u2014 ", _jsx("code", { children: `{{baseUrl}}` }), " =", " ", _jsx("span", { className: "font-mono text-emerald-600", children: envs.find((e) => e.id === envId).base_url })] }))] })) : (_jsxs("span", { className: "text-amber-600", children: ["No environment selected \u2014 ", _jsx("code", { children: `{{baseUrl}}` }), " will not be substituted."] })) }), _jsx(ItemsList, { collection: c, onChanged: () => qc.invalidateQueries({ queryKey: ["cols"] }), onItemResult: (r) => setResults((prev) => ({ ...prev, [c.id]: r })), environmentId: envId || undefined }), _jsx(AddRequestForm, { collectionId: c.id, onAdded: () => qc.invalidateQueries({ queryKey: ["cols"] }) })] })), results[c.id] && _jsx(RunResults, { result: results[c.id] })] }, c.id));
                }) })] }));
}
