import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Trash2, Copy, ShieldCheck, ShieldAlert, Clock, } from "lucide-react";
const KINDS = [
    "bearer",
    "api_key",
    "basic",
    "oauth2_client_credentials",
    "oauth2_authorization_code",
];
const KIND_BADGE = {
    bearer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    api_key: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
    basic: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    oauth2_client_credentials: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    oauth2_authorization_code: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
};
const PRESETS = {
    bearer: {
        config: "{}",
        secrets: `{
  "token": "paste-static-bearer-token-here"
}`,
        hint: "Static bearer token. Returned as-is when requested.",
    },
    api_key: {
        config: `{
  "header": "X-API-Key"
}`,
        secrets: `{
  "key": "paste-api-key-here"
}`,
        hint: "Sent as a header (or query param) on outbound requests.",
    },
    basic: {
        config: "{}",
        secrets: `{
  "username": "user",
  "password": "pass"
}`,
        hint: "HTTP Basic auth — base64-encoded at request time.",
    },
    oauth2_client_credentials: {
        config: `{
  "token_url": "https://idp.example.com/oauth2/token",
  "scope": "read write",
  "audience": ""
}`,
        secrets: `{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret"
}`,
        hint: "Server fetches a token from token_url and auto-refreshes before expiry.",
    },
    oauth2_authorization_code: {
        config: `{
  "authorize_url": "https://idp.example.com/oauth2/authorize",
  "token_url": "https://idp.example.com/oauth2/token",
  "redirect_uri": "http://localhost:8000/api/v1/vault/callback",
  "scope": "openid profile"
}`,
        secrets: `{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret"
}`,
        hint: "User-interactive flow. Refresh tokens stored encrypted after first login.",
    },
};
const EMPTY_FORM = {
    name: "",
    kind: "bearer",
    config: PRESETS.bearer.config,
    secrets: PRESETS.bearer.secrets,
};
function formatExpiry(iso) {
    if (!iso)
        return { text: "no token cached", tone: "none" };
    const exp = new Date(iso).getTime();
    const now = Date.now();
    const diff = exp - now;
    if (diff <= 0)
        return { text: "expired", tone: "expired" };
    const mins = Math.round(diff / 60000);
    if (mins < 60)
        return { text: `${mins}m left`, tone: mins < 5 ? "soon" : "ok" };
    const hrs = Math.round(mins / 60);
    if (hrs < 48)
        return { text: `${hrs}h left`, tone: "ok" };
    return { text: `${Math.round(hrs / 24)}d left`, tone: "ok" };
}
export default function Vault() {
    const qc = useQueryClient();
    const [form, setForm] = useState(EMPTY_FORM);
    const [parseError, setParseError] = useState(null);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);
    const { data: profiles, isLoading } = useQuery({
        queryKey: ["vault"],
        queryFn: async () => (await api.get("/vault")).data,
    });
    const create = useMutation({
        mutationFn: async () => {
            setParseError(null);
            let config = {};
            let secrets = {};
            try {
                if (form.config.trim())
                    config = JSON.parse(form.config);
            }
            catch {
                throw new Error("Config must be valid JSON object");
            }
            try {
                if (form.secrets.trim())
                    secrets = JSON.parse(form.secrets);
            }
            catch {
                throw new Error("Secrets must be valid JSON object");
            }
            return (await api.post("/vault", {
                name: form.name,
                kind: form.kind,
                config,
                secrets,
            })).data;
        },
        onSuccess: () => {
            setForm({ ...EMPTY_FORM });
            qc.invalidateQueries({ queryKey: ["vault"] });
        },
        onError: (err) => {
            const msg = err?.response?.data?.detail ?? err?.message ?? "Failed to create profile";
            setParseError(typeof msg === "string" ? msg : JSON.stringify(msg));
        },
    });
    const refresh = useMutation({
        mutationFn: async (id) => (await api.post(`/vault/${id}/refresh`)).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
    });
    const del = useMutation({
        mutationFn: async (id) => api.delete(`/vault/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
    });
    function applyKind(kind) {
        setForm((f) => ({
            ...f,
            kind,
            config: PRESETS[kind].config,
            secrets: PRESETS[kind].secrets,
        }));
    }
    function copy(text) {
        navigator.clipboard?.writeText(text).catch(() => { });
    }
    const tokenSummary = useMemo(() => {
        const list = profiles ?? [];
        return {
            total: list.length,
            withToken: list.filter((p) => p.has_access_token).length,
            expiring: list.filter((p) => {
                const t = formatExpiry(p.access_token_expires_at).tone;
                return t === "soon" || t === "expired";
            }).length,
        };
    }, [profiles, now]); // re-eval on tick
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-end justify-between flex-wrap gap-3", children: [_jsxs("div", { children: [_jsxs("h1", { className: "h-title flex items-center gap-2", children: [_jsx(KeyRound, { className: "text-amber-500" }), " Token Vault"] }), _jsx("p", { className: "text-sm text-slate-500", children: "Encrypted credential profiles \u00B7 Fernet-encrypted at rest, never returned in plain text." })] }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("span", { className: "badge-info", children: [tokenSummary.total, " profiles"] }), _jsxs("span", { className: "badge-success", children: [tokenSummary.withToken, " cached"] }), tokenSummary.expiring > 0 && (_jsxs("span", { className: "badge-warn", children: [tokenSummary.expiring, " expiring"] }))] })] }), _jsxs("div", { className: "card p-5 space-y-4", children: [_jsx("h2", { className: "font-semibold text-sm bg-gradient-brand bg-clip-text text-transparent", children: "Add a credential profile" }), _jsxs("div", { className: "grid md:grid-cols-2 gap-3", children: [_jsx("input", { className: "input", placeholder: "Profile name (e.g. zpe-prod)", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx("select", { className: "input", value: form.kind, onChange: (e) => applyKind(e.target.value), children: KINDS.map((k) => _jsx("option", { value: k, children: k }, k)) })] }), _jsx("p", { className: "text-xs text-slate-500 italic", children: PRESETS[form.kind].hint }), _jsxs("div", { className: "grid md:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Config (JSON \u00B7 stored as plain)" }), _jsx("textarea", { className: "input font-mono text-xs mt-1 h-40", value: form.config, onChange: (e) => setForm({ ...form, config: e.target.value }) })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs text-slate-500 flex items-center gap-1", children: [_jsx(ShieldCheck, { size: 12, className: "text-emerald-500" }), "Secrets (JSON \u00B7 encrypted at rest)"] }), _jsx("textarea", { className: "input font-mono text-xs mt-1 h-40", value: form.secrets, onChange: (e) => setForm({ ...form, secrets: e.target.value }) })] })] }), parseError && _jsx("div", { className: "text-sm text-rose-600", children: parseError }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "btn-primary", disabled: !form.name || create.isPending, onClick: () => create.mutate(), children: create.isPending ? "Saving…" : "Create profile" }), _jsx("button", { className: "btn-ghost", type: "button", onClick: () => { setForm({ ...EMPTY_FORM }); setParseError(null); }, children: "Reset" })] })] }), _jsx("div", { className: "card overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-left text-xs uppercase tracking-wide text-slate-500\r\n                            bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2", children: "Name" }), _jsx("th", { className: "px-2 py-2", children: "Kind" }), _jsx("th", { className: "px-2 py-2", children: "Secrets (masked)" }), _jsx("th", { className: "px-2 py-2", children: "Token" }), _jsx("th", { className: "px-2 py-2", children: "Created" }), _jsx("th", { className: "px-4 py-2 text-right", children: "Actions" })] }) }), _jsxs("tbody", { children: [isLoading && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-6 text-center text-slate-500", children: "Loading\u2026" }) })), !isLoading && (profiles?.length ?? 0) === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-6 text-center text-slate-500", children: "No credential profiles yet \u2014 add one above." }) })), profiles?.map((p) => {
                                    const exp = formatExpiry(p.access_token_expires_at);
                                    const isRefreshing = refresh.isPending && refresh.variables === p.id;
                                    const isDeleting = del.isPending && del.variables === p.id;
                                    return (_jsxs("tr", { className: "border-b border-slate-100 dark:border-slate-800\r\n                               hover:bg-slate-50/60 dark:hover:bg-slate-800/30", children: [_jsxs("td", { className: "px-4 py-3 align-top", children: [_jsx("div", { className: "font-medium", children: p.name }), _jsxs("div", { className: "text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1", children: [p.id.slice(0, 8), "\u2026", _jsx("button", { title: "Copy ID", onClick: () => copy(p.id), className: "text-slate-400 hover:text-brand-500", children: _jsx(Copy, { size: 11 }) })] })] }), _jsx("td", { className: "px-2 py-3 align-top", children: _jsx("span", { className: `badge ${KIND_BADGE[p.kind] ?? "badge-info"}`, children: p.kind }) }), _jsx("td", { className: "px-2 py-3 align-top font-mono text-xs space-y-0.5 max-w-xs", children: Object.keys(p.masked_secrets).length === 0
                                                    ? _jsx("span", { className: "text-slate-400 italic", children: "none" })
                                                    : Object.entries(p.masked_secrets).map(([k, v]) => (_jsxs("div", { className: "truncate", children: [_jsxs("span", { className: "text-slate-500", children: [k, ":"] }), " ", v] }, k))) }), _jsx("td", { className: "px-2 py-3 align-top", children: p.has_access_token ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs " +
                                                        (exp.tone === "expired" ? "text-rose-600"
                                                            : exp.tone === "soon" ? "text-amber-600"
                                                                : "text-emerald-600"), children: [exp.tone === "expired"
                                                            ? _jsx(ShieldAlert, { size: 12 })
                                                            : _jsx(Clock, { size: 12 }), exp.text] })) : (_jsx("span", { className: "text-xs text-slate-400", children: "\u2014" })) }), _jsx("td", { className: "px-2 py-3 align-top text-xs text-slate-500", children: new Date(p.created_at).toLocaleDateString() }), _jsxs("td", { className: "px-4 py-3 align-top", children: [_jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs("button", { className: "btn-secondary", title: "Force refresh token", disabled: isRefreshing, onClick: () => refresh.mutate(p.id), children: [_jsx(RefreshCw, { size: 14, className: isRefreshing ? "animate-spin" : "" }), _jsx("span", { className: "ml-1", children: "Refresh" })] }), _jsx("button", { className: "btn-danger", title: "Delete profile", disabled: isDeleting, onClick: () => {
                                                                    if (confirm(`Delete profile "${p.name}"? This cannot be undone.`)) {
                                                                        del.mutate(p.id);
                                                                    }
                                                                }, children: _jsx(Trash2, { size: 14 }) })] }), refresh.isError && refresh.variables === p.id && (_jsx("div", { className: "mt-2 text-xs text-rose-600 text-right max-w-xs", children: refresh.error?.response?.data?.detail
                                                            ?? refresh.error?.message
                                                            ?? "Refresh failed" }))] })] }, p.id));
                                })] })] }) })] }));
}
