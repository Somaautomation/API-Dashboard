import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Sparkles, Wand2, Repeat, ListChecks } from "lucide-react";

type Tab = "assertions" | "retry" | "tests";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "assertions", label: "Assertions",     icon: Wand2 },
  { id: "retry",      label: "Retry policy",   icon: Repeat },
  { id: "tests",      label: "Test cases",     icon: ListChecks },
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
  const [tab, setTab] = useState<Tab>("assertions");
  const [sample, setSample] = useState(SAMPLE_RESPONSE);
  const [endpoint, setEndpoint] = useState(SAMPLE_ENDPOINT);
  const [errorKind, setErrorKind] = useState("http_error");
  const [statusCode, setStatusCode] = useState<number | "">(503);
  const [latency, setLatency] = useState<number | "">(1500);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const assertions = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/assertions", {
        sample_response: JSON.parse(sample),
      })).data,
    onSuccess: (d) => { setResult(d); setErr(null); },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
  });

  const retry = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/retry-policy", {
        error_kind: errorKind,
        status_code: statusCode === "" ? null : Number(statusCode),
        latency_ms:  latency    === "" ? null : Number(latency),
      })).data,
    onSuccess: (d) => { setResult(d); setErr(null); },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
  });

  const tests = useMutation({
    mutationFn: async () =>
      (await api.post("/ai/test-cases", {
        endpoint: JSON.parse(endpoint),
      })).data,
    onSuccess: (d) => { setResult(d); setErr(null); },
    onError: (e: any) => setErr(e?.response?.data?.detail ?? e?.message ?? "Failed"),
  });

  const pending = assertions.isPending || retry.isPending || tests.isPending;

  function run() {
    setResult(null); setErr(null);
    try {
      if (tab === "assertions") { JSON.parse(sample); assertions.mutate(); }
      else if (tab === "retry")  { retry.mutate(); }
      else                       { JSON.parse(endpoint); tests.mutate(); }
    } catch (e: any) {
      setErr("Invalid JSON: " + e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-title flex items-center gap-2">
          <Sparkles className="text-fuchsia-500" /> AI Assist
        </h1>
        <p className="text-sm text-slate-500">
          Suggest assertions, retry policies, and edge-case test data from sample payloads.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setResult(null); setErr(null); }}
            className={
              "flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition " +
              (tab === id
                ? "border-fuchsia-500 text-fuchsia-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")
            }
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <div className="card p-5 space-y-3">
        {tab === "assertions" && (
          <>
            <label className="text-xs text-slate-500">Sample response JSON</label>
            <textarea
              className="input font-mono text-xs h-56"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              The engine inspects shape + types and emits JSONPath / status / latency assertions.
            </p>
          </>
        )}

        {tab === "retry" && (
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500">Error kind</label>
              <select
                className="input mt-1"
                value={errorKind}
                onChange={(e) => setErrorKind(e.target.value)}
              >
                <option value="http_error">http_error</option>
                <option value="timeout">timeout</option>
                <option value="connection">connection</option>
                <option value="rate_limit">rate_limit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Last status code</label>
              <input
                className="input mt-1"
                type="number"
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Last latency (ms)</label>
              <input
                className="input mt-1"
                type="number"
                value={latency}
                onChange={(e) => setLatency(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {tab === "tests" && (
          <>
            <label className="text-xs text-slate-500">
              Endpoint descriptor (method, path, request_schema…)
            </label>
            <textarea
              className="input font-mono text-xs h-56"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Returns happy-path, validation-failure, and boundary test cases.
            </p>
          </>
        )}

        {err && <div className="text-sm text-rose-600">{err}</div>}

        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            disabled={pending}
            onClick={run}
          >
            {pending ? "Generating…" : "Generate"}
          </button>
          <span className="text-xs text-slate-400">
            POST /api/v1/ai/{tab === "assertions" ? "assertions" : tab === "retry" ? "retry-policy" : "test-cases"}
          </span>
        </div>
      </div>

      {/* Result panel */}
      {result && (
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Result</div>
          <pre className="text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-[60vh]">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
