import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Sparkles, Wand2, Repeat, ListChecks } from "lucide-react";
const TABS = [
    { id: "assertions", label: "Assertions", icon: Wand2 },
    { id: "retry", label: "Retry policy", icon: Repeat },
    { id: "tests", label: "Test cases", icon: ListChecks },
];
const SAMPLE_RESPONSE = `{
  "id": 1,
  "name": "Rex",
  "email": "rex@example.com",
  "active": true,
  "tags": ["dog", "good-boy"]
}`;
const SAMPLE_ENDPOINT = `{
  "method": "POST",
  "path": "/pets",
  "parameters": [],
  "request_schema": {
    "type": "object",
    "required": ["name"],
    "properties": {
      "name":  { "type": "string" },
      "email": { "type": "string", "format": "email" }
    }
  }
}`;
export default function AIAssist() {
    const [tab, setTab] = useState("assertions");
    const [sample, setSample] = useState(SAMPLE_RESPONSE);
    const [endpoint, setEndpoint] = useState(SAMPLE_ENDPOINT);
    const [errorKind, setErrorKind] = useState("http_error");
    const [statusCode, setStatusCode] = useState(503);
    const [latency, setLatency] = useState(1500);
    const [result, setResult] = useState(null);
    const [err, setErr] = useState(null);
    const assertions = useMutation({
        mutationFn: async () => (await api.post("/ai/assertions", {
            sample_response: JSON.parse(sample),
        })).data,
        onSuccess: (d) => { setResult(d); setErr(null); },
        onError: (e) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
    });
    const retry = useMutation({
        mutationFn: async () => (await api.post("/ai/retry-policy", {
            error_kind: errorKind,
            status_code: statusCode === "" ? null : Number(statusCode),
            latency_ms: latency === "" ? null : Number(latency),
        })).data,
        onSuccess: (d) => { setResult(d); setErr(null); },
        onError: (e) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
    });
    const tests = useMutation({
        mutationFn: async () => (await api.post("/ai/test-cases", {
            endpoint: JSON.parse(endpoint),
        })).data,
        onSuccess: (d) => { setResult(d); setErr(null); },
        onError: (e) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
    });
    const pending = assertions.isPending || retry.isPending || tests.isPending;
    function run() {
        setResult(null);
        setErr(null);
        try {
            if (tab === "assertions") {
                JSON.parse(sample);
                assertions.mutate();
            }
            else if (tab === "retry") {
                retry.mutate();
            }
            else {
                JSON.parse(endpoint);
                tests.mutate();
            }
        }
        catch (e) {
            setErr("Invalid JSON: " + e.message);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsxs("h1", { className: "h-title flex items-center gap-2", children: [_jsx(Sparkles, { className: "text-fuchsia-500" }), " AI Assist"] }), _jsx("p", { className: "text-sm text-slate-500", children: "Suggest assertions, retry policies, and edge-case test data from sample payloads." })] }), _jsx("div", { className: "flex gap-1 border-b border-slate-200 dark:border-slate-800", children: TABS.map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => { setTab(id); setResult(null); setErr(null); }, className: "flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition " +
                        (tab === id
                            ? "border-fuchsia-500 text-fuchsia-600 font-semibold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"), children: [_jsx(Icon, { size: 14 }), " ", label] }, id))) }), _jsxs("div", { className: "card p-5 space-y-3", children: [tab === "assertions" && (_jsxs(_Fragment, { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Sample response JSON" }), _jsx("textarea", { className: "input font-mono text-xs h-56", value: sample, onChange: (e) => setSample(e.target.value) }), _jsx("p", { className: "text-xs text-slate-400", children: "The engine inspects shape + types and emits JSONPath / status / latency assertions." })] })), tab === "retry" && (_jsxs("div", { className: "grid md:grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Error kind" }), _jsxs("select", { className: "input mt-1", value: errorKind, onChange: (e) => setErrorKind(e.target.value), children: [_jsx("option", { value: "http_error", children: "http_error" }), _jsx("option", { value: "timeout", children: "timeout" }), _jsx("option", { value: "connection", children: "connection" }), _jsx("option", { value: "rate_limit", children: "rate_limit" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Last status code" }), _jsx("input", { className: "input mt-1", type: "number", value: statusCode, onChange: (e) => setStatusCode(e.target.value === "" ? "" : Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Last latency (ms)" }), _jsx("input", { className: "input mt-1", type: "number", value: latency, onChange: (e) => setLatency(e.target.value === "" ? "" : Number(e.target.value)) })] })] })), tab === "tests" && (_jsxs(_Fragment, { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Endpoint descriptor (method, path, request_schema\u2026)" }), _jsx("textarea", { className: "input font-mono text-xs h-56", value: endpoint, onChange: (e) => setEndpoint(e.target.value) }), _jsx("p", { className: "text-xs text-slate-400", children: "Returns happy-path, validation-failure, and boundary test cases." })] })), err && _jsx("div", { className: "text-sm text-rose-600", children: err }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "btn-primary", disabled: pending, onClick: run, children: pending ? "Generating…" : "Generate" }), _jsxs("span", { className: "text-xs text-slate-400", children: ["POST /api/v1/ai/", tab === "assertions" ? "assertions" : tab === "retry" ? "retry-policy" : "test-cases"] })] })] }), result && (_jsxs("div", { className: "card p-5", children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-slate-500 mb-2", children: "Result" }), _jsx("pre", { className: "text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-[60vh]", children: JSON.stringify(result, null, 2) })] }))] }));
}
