import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Pencil, Play, Save, Sparkles, Trash2, X, } from "lucide-react";
import { api } from "@/lib/api";
const TAB_LABEL = {
    positive: "Positive",
    negative: "Negative",
    boundary: "Boundary",
    edge_cases: "Edge cases",
    security: "Security",
    suggestions: "AI suggestions",
};
const TAB_TONE = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    boundary: "text-amber-600 dark:text-amber-400",
    edge_cases: "text-violet-600 dark:text-violet-400",
    security: "text-sky-600 dark:text-sky-400",
    suggestions: "text-indigo-600 dark:text-indigo-400",
};
const CATEGORY_BADGE = {
    positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    negative: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    boundary: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    edge_case: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    security: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};
export function AiTestGeneratorModal({ endpointId, method, path, baseUrl, onClose }) {
    // ---- generation options ------------------------------------------------
    const [includePositive, setIncludePositive] = useState(true);
    const [includeNegative, setIncludeNegative] = useState(true);
    const [includeBoundary, setIncludeBoundary] = useState(true);
    const [includeEdgeCases, setIncludeEdgeCases] = useState(true);
    const [includeSecurity, setIncludeSecurity] = useState(false);
    const [responseTimeMs, setResponseTimeMs] = useState(2000);
    const [useAi, setUseAi] = useState(true);
    const [baseUrlField, setBaseUrlField] = useState(baseUrl || "{{baseUrl}}");
    const [suite, setSuite] = useState(null);
    const [tab, setTab] = useState("positive");
    const [editing, setEditing] = useState(null);
    // ---- mutations ---------------------------------------------------------
    const generate = useMutation({
        mutationFn: async () => {
            const { data } = await api.post(`/test-generation/endpoint/${endpointId}`, {
                options: {
                    include_positive: includePositive,
                    include_negative: includeNegative,
                    include_boundary: includeBoundary,
                    include_edge_cases: includeEdgeCases,
                    include_security: includeSecurity,
                    response_time_threshold_ms: responseTimeMs,
                    use_ai: useAi,
                    base_url: baseUrlField,
                },
            });
            return data;
        },
        onSuccess: (data) => {
            setSuite(data);
            // Auto-jump to the first non-empty tab.
            const order = ["positive", "negative", "boundary", "edge_cases", "security"];
            for (const k of order) {
                const list = data[k];
                if (list?.length) {
                    setTab(k);
                    return;
                }
            }
            if (data.edge_suggestions?.length)
                setTab("suggestions");
        },
    });
    const saveCollection = useMutation({
        mutationFn: async (name) => {
            const { data } = await api.post("/test-generation/suites/save", {
                name,
                description: `AI-generated tests for ${method} ${path}`,
                tags: ["ai-generated", method.toLowerCase()],
                suites: suite ? [suite] : [],
            });
            return data;
        },
    });
    const exportJson = useMutation({
        mutationFn: async () => {
            const name = `${method}-${path.replace(/\W+/g, "_")}-tests`;
            const res = await api.post("/test-generation/suites/export", { name, suites: suite ? [suite] : [] }, { responseType: "blob" });
            const blob = res.data;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${name}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
    });
    // ---- derived -----------------------------------------------------------
    const currentList = useMemo(() => {
        if (!suite)
            return [];
        if (tab === "edge_cases")
            return suite.edge_cases;
        if (tab === "suggestions")
            return [];
        return suite[tab] || [];
    }, [suite, tab]);
    const counts = suite?.counts ?? {};
    const total = counts.total ?? 0;
    // ---- mutators (local) --------------------------------------------------
    function updateCase(updated) {
        if (!suite)
            return;
        const key = updated.category === "edge_case" ? "edge_cases" : updated.category;
        const list = suite[key].map((c) => c.id === updated.id ? updated : c);
        setSuite({ ...suite, [key]: list });
    }
    function removeCase(id, category) {
        if (!suite)
            return;
        const key = category === "edge_case" ? "edge_cases" : category;
        const list = suite[key].filter((c) => c.id !== id);
        const next = { ...suite, [key]: list };
        next.counts = {
            ...next.counts,
            [category]: list.length,
            total: (next.counts.total ?? 0) - 1,
        };
        setSuite(next);
    }
    // ---- save flow ---------------------------------------------------------
    function handleSave() {
        const fallback = `AI Tests — ${method} ${path}`;
        const name = window.prompt("Save as Collection — name?", fallback);
        if (!name)
            return;
        saveCollection.mutate(name);
    }
    // ---- render ------------------------------------------------------------
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4", onClick: onClose, children: _jsxs("div", { className: "bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Sparkles, { className: "w-5 h-5 text-violet-500 mt-0.5" }), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold", children: "AI Test Generator" }), _jsxs("p", { className: "text-xs text-slate-500 font-mono mt-0.5", children: [method.toUpperCase(), " ", path] })] })] }), _jsx("button", { className: "btn-ghost", onClick: onClose, "aria-label": "Close", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs", children: [_jsx(Toggle, { label: "Positive", checked: includePositive, onChange: setIncludePositive }), _jsx(Toggle, { label: "Negative", checked: includeNegative, onChange: setIncludeNegative }), _jsx(Toggle, { label: "Boundary", checked: includeBoundary, onChange: setIncludeBoundary }), _jsx(Toggle, { label: "Edge cases", checked: includeEdgeCases, onChange: setIncludeEdgeCases }), _jsx(Toggle, { label: "Security", checked: includeSecurity, onChange: setIncludeSecurity }), _jsx(Toggle, { label: "Use AI for suggestions", checked: useAi, onChange: setUseAi }), _jsxs("label", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-slate-500", children: "Response time \u2264" }), _jsx("input", { type: "number", className: "input w-20 py-1 text-xs", value: responseTimeMs, min: 50, step: 50, onChange: (e) => setResponseTimeMs(Number(e.target.value) || 2000) }), _jsx("span", { className: "text-slate-500", children: "ms" })] }), _jsxs("label", { className: "flex items-center gap-1 min-w-[260px] flex-1", children: [_jsx("span", { className: "text-slate-500", children: "Base URL" }), _jsx("input", { className: "input py-1 text-xs flex-1", value: baseUrlField, onChange: (e) => setBaseUrlField(e.target.value), placeholder: "{{baseUrl}}" })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { type: "button", className: "btn-primary inline-flex items-center gap-2 text-sm", onClick: () => generate.mutate(), disabled: generate.isPending, children: [generate.isPending ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Sparkles, { className: "w-4 h-4" })), suite ? "Regenerate" : "Generate AI Tests"] }), suite && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "btn-ghost text-xs inline-flex items-center gap-1", onClick: () => exportJson.mutate(), disabled: exportJson.isPending, children: [_jsx(Download, { className: "w-3.5 h-3.5" }), " Export JSON"] }), _jsxs("button", { type: "button", className: "btn-ghost text-xs inline-flex items-center gap-1", onClick: handleSave, disabled: saveCollection.isPending, children: [_jsx(Save, { className: "w-3.5 h-3.5" }), saveCollection.isPending ? "Saving…" : "Save as Collection"] }), _jsxs("span", { className: "ml-auto text-xs text-slate-500", children: ["Generated ", total, " tests \u00B7 ", counts.positive ?? 0, "\u2713 ", counts.negative ?? 0, "\u2717", " ", counts.boundary ?? 0, "\u21C4 ", counts.edge_case ?? 0, "\u2726 ", counts.security ?? 0, "\uD83D\uDEE1"] })] }))] }), generate.isError && (_jsxs("div", { className: "text-xs text-rose-600 flex items-center gap-1", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), "Failed to generate: ", generate.error.message] })), saveCollection.isSuccess && saveCollection.data && (_jsxs("div", { className: "text-xs text-emerald-600 flex items-center gap-1", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), "Saved collection \u201C", saveCollection.data.name, "\u201D with", " ", saveCollection.data.item_count, " items. Open the Collections page to run it."] }))] }), !suite ? (_jsxs("div", { className: "flex-1 flex items-center justify-center text-sm text-slate-400", children: ["Choose options above and click ", _jsx("span", { className: "mx-1 font-medium", children: "Generate AI Tests" }), " ", "to begin."] })) : (_jsxs("div", { className: "flex-1 flex min-h-0", children: [_jsx("nav", { className: "w-44 border-r border-slate-200 dark:border-slate-800 p-2 space-y-1 text-xs", children: Object.keys(TAB_LABEL).map((k) => {
                                const count = k === "edge_cases"
                                    ? suite.edge_cases.length
                                    : k === "suggestions"
                                        ? suite.edge_suggestions.length
                                        : suite[k]?.length ?? 0;
                                return (_jsxs("button", { type: "button", onClick: () => setTab(k), className: `w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${tab === k
                                        ? "bg-slate-100 dark:bg-slate-800 font-medium"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`, children: [_jsx("span", { className: TAB_TONE[k], children: TAB_LABEL[k] }), _jsx("span", { className: "text-[10px] text-slate-400", children: count })] }, k));
                            }) }), _jsx("div", { className: "flex-1 overflow-auto p-3 space-y-2", children: tab === "suggestions" ? (_jsx(SuggestionsPanel, { suggestions: suite.edge_suggestions })) : currentList.length === 0 ? (_jsx("div", { className: "text-sm text-slate-400 px-2 py-6", children: "No tests in this category." })) : (currentList.map((c) => (_jsx(TestCaseRow, { testCase: c, isEditing: editing === c.id, onToggleEdit: () => setEditing(editing === c.id ? null : c.id), onChange: updateCase, onRemove: () => removeCase(c.id, c.category) }, c.id)))) })] }))] }) }));
}
// ============================================================================
function Toggle({ label, checked, onChange, }) {
    return (_jsxs("label", { className: "inline-flex items-center gap-1 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", className: "h-3.5 w-3.5", checked: checked, onChange: (e) => onChange(e.target.checked) }), _jsx("span", { children: label })] }));
}
function TestCaseRow({ testCase, isEditing, onToggleEdit, onChange, onRemove, }) {
    const [open, setOpen] = useState(false);
    const [bodyText, setBodyText] = useState(() => testCase.body == null ? "" : JSON.stringify(testCase.body, null, 2));
    const [bodyError, setBodyError] = useState(null);
    const [nameDraft, setNameDraft] = useState(testCase.name);
    const [statusDraft, setStatusDraft] = useState(testCase.expected_status ?? "");
    function commit() {
        let parsed = testCase.body;
        if (bodyText.trim()) {
            try {
                parsed = JSON.parse(bodyText);
            }
            catch (e) {
                setBodyError(e.message);
                return;
            }
        }
        else {
            parsed = null;
        }
        setBodyError(null);
        onChange({
            ...testCase,
            body: parsed,
            name: nameDraft,
            expected_status: statusDraft === "" || statusDraft == null ? undefined : Number(statusDraft),
        });
        onToggleEdit();
    }
    return (_jsxs("div", { className: "border border-slate-200 dark:border-slate-700 rounded", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2", children: [_jsx("button", { type: "button", onClick: () => setOpen((v) => !v), className: "text-slate-400 hover:text-slate-600", "aria-label": "Toggle details", children: open ? _jsx(ChevronDown, { className: "w-4 h-4" }) : _jsx(ChevronRight, { className: "w-4 h-4" }) }), _jsx("span", { className: `badge px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_BADGE[testCase.category]}`, children: testCase.category }), _jsx("span", { className: "font-mono text-[11px] text-slate-400", children: testCase.method }), typeof testCase.expected_status === "number" && (_jsxs("span", { className: "text-[11px] font-mono text-slate-500", children: ["\u2192 ", testCase.expected_status] })), _jsx("span", { className: "text-xs flex-1 truncate", children: testCase.name }), _jsxs("button", { type: "button", onClick: onToggleEdit, className: "btn-ghost text-[11px] inline-flex items-center gap-1", title: "Edit", children: [_jsx(Pencil, { className: "w-3 h-3" }), " ", isEditing ? "Cancel" : "Edit"] }), _jsx("button", { type: "button", onClick: onRemove, className: "btn-ghost text-[11px] inline-flex items-center gap-1 text-rose-600", title: "Remove", children: _jsx(Trash2, { className: "w-3 h-3" }) })] }), open && (_jsxs("div", { className: "px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs", children: [testCase.description && (_jsx("p", { className: "text-slate-500", children: testCase.description })), _jsx("div", { className: "font-mono text-[11px] text-slate-500 break-all", children: testCase.url }), isEditing ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-[11px] text-slate-500", children: "Name" }), _jsx("input", { className: "input mt-0.5", value: nameDraft, onChange: (e) => setNameDraft(e.target.value) })] }), _jsxs("label", { className: "block w-32", children: [_jsx("span", { className: "text-[11px] text-slate-500", children: "Expected status" }), _jsx("input", { type: "number", className: "input mt-0.5", value: statusDraft, onChange: (e) => setStatusDraft(e.target.value) })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-[11px] text-slate-500", children: "Body (JSON)" }), _jsx("textarea", { className: "input mt-0.5 font-mono text-[11px] h-40", value: bodyText, onChange: (e) => setBodyText(e.target.value) }), bodyError && (_jsx("span", { className: "text-rose-600 text-[11px]", children: bodyError }))] }), _jsx("div", { children: _jsx("button", { type: "button", className: "btn-primary text-xs", onClick: commit, children: "Save changes" }) })] })) : (_jsxs(Fragment, { children: [testCase.body != null && (_jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer text-slate-500", children: "Payload" }), _jsx("pre", { className: "mt-1 bg-slate-950 text-emerald-300 p-2 rounded font-mono text-[11px] overflow-auto max-h-60", children: JSON.stringify(testCase.body, null, 2) })] })), Object.keys(testCase.headers || {}).length > 0 && (_jsxs("details", { children: [_jsxs("summary", { className: "cursor-pointer text-slate-500", children: ["Headers (", Object.keys(testCase.headers).length, ")"] }), _jsx("pre", { className: "mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap", children: Object.entries(testCase.headers)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join("\n") })] }))] })), _jsxs("div", { children: [_jsx("div", { className: "text-[11px] text-slate-500 font-medium mt-2", children: "Assertions" }), _jsxs("ul", { className: "space-y-1 mt-1", children: [testCase.assertions.map((a, i) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx(Play, { className: "w-3 h-3 mt-0.5 text-slate-400" }), _jsxs("div", { children: [_jsx("code", { className: "text-[11px] font-mono", children: a.type }), a.description && (_jsxs("span", { className: "text-[11px] text-slate-500 ml-2", children: ["\u2014 ", a.description] }))] })] }, i))), testCase.assertions.length === 0 && (_jsx("li", { className: "text-[11px] text-slate-400", children: "No assertions" }))] })] })] }))] }));
}
function SuggestionsPanel({ suggestions }) {
    if (!suggestions.length) {
        return (_jsx("div", { className: "text-sm text-slate-400 px-2 py-6", children: "No additional suggestions for this endpoint." }));
    }
    return (_jsx("div", { className: "space-y-2", children: suggestions.map((s) => (_jsxs("div", { className: "border border-slate-200 dark:border-slate-700 rounded p-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm", children: [_jsx("code", { className: "font-mono", children: s.field }), _jsx("span", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: s.type }), _jsx("span", { className: `text-[10px] ml-auto px-1.5 py-0.5 rounded ${s.source === "ai"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-slate-100 text-slate-600"}`, children: s.source })] }), s.rationale && (_jsx("p", { className: "text-[11px] text-slate-500 mt-1", children: s.rationale })), _jsx("ul", { className: "mt-2 text-[12px] text-slate-700 dark:text-slate-200 list-disc pl-5 space-y-0.5", children: s.suggestions.map((sug, i) => (_jsx("li", { children: sug }, i))) })] }, s.field))) }));
}
