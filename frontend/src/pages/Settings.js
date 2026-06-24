import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";
const KINDS = ["dev", "qa", "stage", "prod", "custom"];
function safeParseJson(text) {
    const t = text.trim();
    if (!t)
        return {};
    const obj = JSON.parse(t);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
    }
    throw new Error("Variables must be a JSON object of strings");
}
function EnvForm({ initial, onDone, onCancel, }) {
    const isEdit = !!initial;
    const [name, setName] = useState(initial?.name ?? "");
    const [kind, setKind] = useState(initial?.kind ?? "dev");
    const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "");
    const [varsText, setVarsText] = useState(JSON.stringify(initial?.variables ?? {}, null, 2));
    const [err, setErr] = useState(null);
    useEffect(() => {
        if (initial) {
            setName(initial.name);
            setKind(initial.kind);
            setBaseUrl(initial.base_url);
            setVarsText(JSON.stringify(initial.variables ?? {}, null, 2));
        }
    }, [initial]);
    const save = useMutation({
        mutationFn: async () => {
            setErr(null);
            const payload = {
                name,
                kind,
                base_url: baseUrl,
                variables: safeParseJson(varsText),
            };
            if (isEdit) {
                return (await api.put(`/environments/${initial.id}`, payload)).data;
            }
            return (await api.post(`/environments`, payload)).data;
        },
        onSuccess: () => {
            if (!isEdit) {
                setName("");
                setBaseUrl("");
                setVarsText("{}");
            }
            onDone();
        },
        onError: (e) => setErr(e?.response?.data?.detail ?? e.message ?? "Failed"),
    });
    return (_jsxs("div", { className: "rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50/60 dark:bg-slate-800/30", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-slate-600 dark:text-slate-300", children: isEdit ? "Edit environment" : "New environment" }), onCancel && (_jsx("button", { className: "text-xs text-slate-500 hover:underline ml-auto", onClick: onCancel, children: "Cancel" }))] }), _jsxs("div", { className: "grid grid-cols-[1fr_120px] gap-2", children: [_jsx("input", { className: "input", placeholder: "Name (e.g. ZPECloud QA)", value: name, onChange: (e) => setName(e.target.value) }), _jsx("select", { className: "input", value: kind, onChange: (e) => setKind(e.target.value), children: KINDS.map((k) => _jsx("option", { value: k, children: k }, k)) })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-[11px] text-slate-500", children: ["Base URL (becomes ", `{{baseUrl}}`, ")"] }), _jsx("input", { className: "input", placeholder: "https://api.qa-zpecloud.com", value: baseUrl, onChange: (e) => setBaseUrl(e.target.value) })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-[11px] text-slate-500", children: ["Variables (JSON object) \u2014 used as ", `{{key}}`, " in URL/headers/body"] }), _jsx("textarea", { className: "input font-mono text-xs h-32", placeholder: '{"token":"abc","userId":"42"}', value: varsText, onChange: (e) => setVarsText(e.target.value) })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx("button", { className: "btn-primary ml-auto", disabled: !name || save.isPending, onClick: () => save.mutate(), children: save.isPending ? "Saving…" : isEdit ? "Save" : "Create" }) }), err && _jsx("div", { className: "text-xs text-red-600 whitespace-pre-wrap", children: err })] }));
}
export default function Settings() {
    const qc = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const [editingId, setEditingId] = useState(null);
    const { data: envs } = useQuery({
        queryKey: ["envs"],
        queryFn: async () => (await api.get("/environments")).data,
    });
    const del = useMutation({
        mutationFn: async (id) => api.delete(`/environments/${id}`),
        onSuccess: () => {
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ["envs"] });
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Settings" }), _jsxs("div", { className: "card p-4", children: [_jsx("div", { className: "text-sm font-medium mb-2", children: "Current user" }), _jsx("pre", { className: "text-xs font-mono", children: JSON.stringify(user, null, 2) })] }), _jsxs("div", { className: "card p-4 space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", children: "Global environments & variables" }), _jsxs("div", { className: "text-xs text-slate-500", children: ["Use ", _jsx("code", { children: `{{baseUrl}}` }), " and ", _jsx("code", { children: `{{anyVar}}` }), " in request URLs, headers and body \u2014 they're substituted at run time from the selected environment."] })] }), envs && envs.length > 0 ? (_jsx("div", { className: "space-y-2", children: envs.map((e) => {
                            const editing = editingId === e.id;
                            return (_jsxs("div", { className: "border border-slate-200 dark:border-slate-700 rounded-md", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2", children: [_jsx("span", { className: "badge bg-slate-100 dark:bg-slate-800 text-[10px] uppercase", children: e.kind }), _jsx("span", { className: "font-semibold", children: e.name }), _jsx("span", { className: "font-mono text-xs text-slate-500 truncate flex-1", title: e.base_url, children: e.base_url || "(no base URL)" }), _jsxs("span", { className: "text-[11px] text-slate-500", children: [Object.keys(e.variables ?? {}).length, " var(s)"] }), _jsx("button", { className: "text-slate-600 dark:text-slate-300 hover:underline text-[11px]", onClick: () => setEditingId(editing ? null : e.id), children: editing ? "Close" : "Edit" }), _jsx("button", { className: "text-rose-600 hover:underline text-[11px]", disabled: del.isPending, onClick: () => {
                                                    if (confirm(`Delete environment "${e.name}"?`))
                                                        del.mutate(e.id);
                                                }, children: "Delete" })] }), editing && (_jsx("div", { className: "px-3 pb-3", children: _jsx(EnvForm, { initial: e, onCancel: () => setEditingId(null), onDone: () => {
                                                setEditingId(null);
                                                qc.invalidateQueries({ queryKey: ["envs"] });
                                            } }) }))] }, e.id));
                        }) })) : (_jsx("div", { className: "text-xs text-slate-500 italic", children: "No environments yet \u2014 create one below." })), _jsx(EnvForm, { onDone: () => qc.invalidateQueries({ queryKey: ["envs"] }) })] })] }));
}
