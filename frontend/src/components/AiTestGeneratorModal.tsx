import { Fragment, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Play,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

// ---- Types shared with backend DTOs ---------------------------------------
export interface Assertion {
  type: string;
  description?: string;
  expected?: unknown;
  expected_in?: number[];
  name?: string;
  contains?: string;
  path?: string[];
  schema?: Record<string, unknown>;
  threshold_ms?: number;
}

export interface GeneratedTestCase {
  id: string;
  name: string;
  category: "positive" | "negative" | "boundary" | "edge_case" | "security";
  description?: string;
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  assertions: Assertion[];
  tags: string[];
  expected_status?: number;
}

export interface EdgeCaseSuggestion {
  field: string;
  type: string;
  suggestions: string[];
  rationale?: string;
  source: "heuristic" | "ai";
}

export interface TestSuite {
  endpoint_id?: string | null;
  method: string;
  path: string;
  summary?: string;
  operation_id?: string | null;
  base_url: string;
  positive: GeneratedTestCase[];
  negative: GeneratedTestCase[];
  boundary: GeneratedTestCase[];
  edge_cases: GeneratedTestCase[];
  security: GeneratedTestCase[];
  edge_suggestions: EdgeCaseSuggestion[];
  counts: Record<string, number>;
  generated_at: string;
}

interface Props {
  endpointId: string;
  method: string;
  path: string;
  baseUrl?: string;
  onClose: () => void;
}

type TabKey = "positive" | "negative" | "boundary" | "edge_cases" | "security" | "suggestions";

const TAB_LABEL: Record<TabKey, string> = {
  positive: "Positive",
  negative: "Negative",
  boundary: "Boundary",
  edge_cases: "Edge cases",
  security: "Security",
  suggestions: "AI suggestions",
};

const TAB_TONE: Record<TabKey, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  boundary: "text-amber-600 dark:text-amber-400",
  edge_cases: "text-violet-600 dark:text-violet-400",
  security: "text-sky-600 dark:text-sky-400",
  suggestions: "text-indigo-600 dark:text-indigo-400",
};

const CATEGORY_BADGE: Record<GeneratedTestCase["category"], string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  negative: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  boundary: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  edge_case: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  security: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

export function AiTestGeneratorModal({ endpointId, method, path, baseUrl, onClose }: Props) {
  // ---- generation options ------------------------------------------------
  const [includePositive, setIncludePositive] = useState(true);
  const [includeNegative, setIncludeNegative] = useState(true);
  const [includeBoundary, setIncludeBoundary] = useState(true);
  const [includeEdgeCases, setIncludeEdgeCases] = useState(true);
  const [includeSecurity, setIncludeSecurity] = useState(false);
  const [responseTimeMs, setResponseTimeMs] = useState(2000);
  const [useAi, setUseAi] = useState(true);
  const [baseUrlField, setBaseUrlField] = useState(baseUrl || "{{baseUrl}}");

  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [tab, setTab] = useState<TabKey>("positive");
  const [editing, setEditing] = useState<string | null>(null);

  // ---- mutations ---------------------------------------------------------
  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<TestSuite>(
        `/test-generation/endpoint/${endpointId}`,
        {
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
        }
      );
      return data;
    },
    onSuccess: (data) => {
      setSuite(data);
      // Auto-jump to the first non-empty tab.
      const order: TabKey[] = ["positive", "negative", "boundary", "edge_cases", "security"];
      for (const k of order) {
        const list = (data as any)[k] as GeneratedTestCase[];
        if (list?.length) {
          setTab(k);
          return;
        }
      }
      if (data.edge_suggestions?.length) setTab("suggestions");
    },
  });

  const saveCollection = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post("/test-generation/suites/save", {
        name,
        description: `AI-generated tests for ${method} ${path}`,
        tags: ["ai-generated", method.toLowerCase()],
        suites: suite ? [suite] : [],
      });
      return data as { collection_id: string; item_count: number; name: string };
    },
  });

  const exportJson = useMutation({
    mutationFn: async () => {
      const name = `${method}-${path.replace(/\W+/g, "_")}-tests`;
      const res = await api.post(
        "/test-generation/suites/export",
        { name, suites: suite ? [suite] : [] },
        { responseType: "blob" }
      );
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  // ---- derived -----------------------------------------------------------
  const currentList = useMemo<GeneratedTestCase[]>(() => {
    if (!suite) return [];
    if (tab === "edge_cases") return suite.edge_cases;
    if (tab === "suggestions") return [];
    return (suite as any)[tab] || [];
  }, [suite, tab]);

  const counts = suite?.counts ?? {};
  const total = counts.total ?? 0;

  // ---- mutators (local) --------------------------------------------------
  function updateCase(updated: GeneratedTestCase) {
    if (!suite) return;
    const key =
      updated.category === "edge_case" ? "edge_cases" : (updated.category as keyof TestSuite);
    const list = ((suite as any)[key] as GeneratedTestCase[]).map((c) =>
      c.id === updated.id ? updated : c
    );
    setSuite({ ...suite, [key]: list } as TestSuite);
  }

  function removeCase(id: string, category: GeneratedTestCase["category"]) {
    if (!suite) return;
    const key = category === "edge_case" ? "edge_cases" : (category as keyof TestSuite);
    const list = ((suite as any)[key] as GeneratedTestCase[]).filter((c) => c.id !== id);
    const next = { ...suite, [key]: list } as TestSuite;
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
    if (!name) return;
    saveCollection.mutate(name);
  }

  // ---- render ------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-violet-500 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold">AI Test Generator</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {method.toUpperCase()} {path}
              </p>
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <Toggle label="Positive" checked={includePositive} onChange={setIncludePositive} />
            <Toggle label="Negative" checked={includeNegative} onChange={setIncludeNegative} />
            <Toggle label="Boundary" checked={includeBoundary} onChange={setIncludeBoundary} />
            <Toggle label="Edge cases" checked={includeEdgeCases} onChange={setIncludeEdgeCases} />
            <Toggle label="Security" checked={includeSecurity} onChange={setIncludeSecurity} />
            <Toggle label="Use AI for suggestions" checked={useAi} onChange={setUseAi} />
            <label className="flex items-center gap-1">
              <span className="text-slate-500">Response time ≤</span>
              <input
                type="number"
                className="input w-20 py-1 text-xs"
                value={responseTimeMs}
                min={50}
                step={50}
                onChange={(e) => setResponseTimeMs(Number(e.target.value) || 2000)}
              />
              <span className="text-slate-500">ms</span>
            </label>
            <label className="flex items-center gap-1 min-w-[260px] flex-1">
              <span className="text-slate-500">Base URL</span>
              <input
                className="input py-1 text-xs flex-1"
                value={baseUrlField}
                onChange={(e) => setBaseUrlField(e.target.value)}
                placeholder="{{baseUrl}}"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2 text-sm"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {suite ? "Regenerate" : "Generate AI Tests"}
            </button>
            {suite && (
              <>
                <button
                  type="button"
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                  onClick={() => exportJson.mutate()}
                  disabled={exportJson.isPending}
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                  onClick={handleSave}
                  disabled={saveCollection.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saveCollection.isPending ? "Saving…" : "Save as Collection"}
                </button>
                <span className="ml-auto text-xs text-slate-500">
                  Generated {total} tests · {counts.positive ?? 0}✓ {counts.negative ?? 0}✗{" "}
                  {counts.boundary ?? 0}⇄ {counts.edge_case ?? 0}✦ {counts.security ?? 0}🛡
                </span>
              </>
            )}
          </div>
          {generate.isError && (
            <div className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Failed to generate: {(generate.error as Error).message}
            </div>
          )}
          {saveCollection.isSuccess && saveCollection.data && (
            <div className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Saved collection “{saveCollection.data.name}” with{" "}
              {saveCollection.data.item_count} items. Open the Collections page to run it.
            </div>
          )}
        </div>

        {/* Tabs + body */}
        {!suite ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Choose options above and click <span className="mx-1 font-medium">Generate AI Tests</span>{" "}
            to begin.
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            <nav className="w-44 border-r border-slate-200 dark:border-slate-800 p-2 space-y-1 text-xs">
              {(Object.keys(TAB_LABEL) as TabKey[]).map((k) => {
                const count =
                  k === "edge_cases"
                    ? suite.edge_cases.length
                    : k === "suggestions"
                    ? suite.edge_suggestions.length
                    : ((suite as any)[k] as GeneratedTestCase[])?.length ?? 0;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                      tab === k
                        ? "bg-slate-100 dark:bg-slate-800 font-medium"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className={TAB_TONE[k]}>{TAB_LABEL[k]}</span>
                    <span className="text-[10px] text-slate-400">{count}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {tab === "suggestions" ? (
                <SuggestionsPanel suggestions={suite.edge_suggestions} />
              ) : currentList.length === 0 ? (
                <div className="text-sm text-slate-400 px-2 py-6">
                  No tests in this category.
                </div>
              ) : (
                currentList.map((c) => (
                  <TestCaseRow
                    key={c.id}
                    testCase={c}
                    isEditing={editing === c.id}
                    onToggleEdit={() => setEditing(editing === c.id ? null : c.id)}
                    onChange={updateCase}
                    onRemove={() => removeCase(c.id, c.category)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-3.5 w-3.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function TestCaseRow({
  testCase,
  isEditing,
  onToggleEdit,
  onChange,
  onRemove,
}: {
  testCase: GeneratedTestCase;
  isEditing: boolean;
  onToggleEdit: () => void;
  onChange: (c: GeneratedTestCase) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bodyText, setBodyText] = useState(() =>
    testCase.body == null ? "" : JSON.stringify(testCase.body, null, 2)
  );
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(testCase.name);
  const [statusDraft, setStatusDraft] = useState(testCase.expected_status ?? "");

  function commit() {
    let parsed: unknown = testCase.body;
    if (bodyText.trim()) {
      try {
        parsed = JSON.parse(bodyText);
      } catch (e: any) {
        setBodyError(e.message);
        return;
      }
    } else {
      parsed = null;
    }
    setBodyError(null);
    onChange({
      ...testCase,
      body: parsed,
      name: nameDraft,
      expected_status:
        statusDraft === "" || statusDraft == null ? undefined : Number(statusDraft),
    });
    onToggleEdit();
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Toggle details"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span
          className={`badge px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_BADGE[testCase.category]}`}
        >
          {testCase.category}
        </span>
        <span className="font-mono text-[11px] text-slate-400">{testCase.method}</span>
        {typeof testCase.expected_status === "number" && (
          <span className="text-[11px] font-mono text-slate-500">
            → {testCase.expected_status}
          </span>
        )}
        <span className="text-xs flex-1 truncate">{testCase.name}</span>
        <button
          type="button"
          onClick={onToggleEdit}
          className="btn-ghost text-[11px] inline-flex items-center gap-1"
          title="Edit"
        >
          <Pencil className="w-3 h-3" /> {isEditing ? "Cancel" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost text-[11px] inline-flex items-center gap-1 text-rose-600"
          title="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          {testCase.description && (
            <p className="text-slate-500">{testCase.description}</p>
          )}
          <div className="font-mono text-[11px] text-slate-500 break-all">{testCase.url}</div>
          {isEditing ? (
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] text-slate-500">Name</span>
                <input
                  className="input mt-0.5"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
              </label>
              <label className="block w-32">
                <span className="text-[11px] text-slate-500">Expected status</span>
                <input
                  type="number"
                  className="input mt-0.5"
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value as any)}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Body (JSON)</span>
                <textarea
                  className="input mt-0.5 font-mono text-[11px] h-40"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                />
                {bodyError && (
                  <span className="text-rose-600 text-[11px]">{bodyError}</span>
                )}
              </label>
              <div>
                <button type="button" className="btn-primary text-xs" onClick={commit}>
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <Fragment>
              {testCase.body != null && (
                <details>
                  <summary className="cursor-pointer text-slate-500">Payload</summary>
                  <pre className="mt-1 bg-slate-950 text-emerald-300 p-2 rounded font-mono text-[11px] overflow-auto max-h-60">
{JSON.stringify(testCase.body, null, 2)}
                  </pre>
                </details>
              )}
              {Object.keys(testCase.headers || {}).length > 0 && (
                <details>
                  <summary className="cursor-pointer text-slate-500">
                    Headers ({Object.keys(testCase.headers).length})
                  </summary>
                  <pre className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
{Object.entries(testCase.headers)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
                  </pre>
                </details>
              )}
            </Fragment>
          )}

          <div>
            <div className="text-[11px] text-slate-500 font-medium mt-2">Assertions</div>
            <ul className="space-y-1 mt-1">
              {testCase.assertions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Play className="w-3 h-3 mt-0.5 text-slate-400" />
                  <div>
                    <code className="text-[11px] font-mono">{a.type}</code>
                    {a.description && (
                      <span className="text-[11px] text-slate-500 ml-2">
                        — {a.description}
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {testCase.assertions.length === 0 && (
                <li className="text-[11px] text-slate-400">No assertions</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionsPanel({ suggestions }: { suggestions: EdgeCaseSuggestion[] }) {
  if (!suggestions.length) {
    return (
      <div className="text-sm text-slate-400 px-2 py-6">
        No additional suggestions for this endpoint.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <div
          key={s.field}
          className="border border-slate-200 dark:border-slate-700 rounded p-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <code className="font-mono">{s.field}</code>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              {s.type}
            </span>
            <span
              className={`text-[10px] ml-auto px-1.5 py-0.5 rounded ${
                s.source === "ai"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {s.source}
            </span>
          </div>
          {s.rationale && (
            <p className="text-[11px] text-slate-500 mt-1">{s.rationale}</p>
          )}
          <ul className="mt-2 text-[12px] text-slate-700 dark:text-slate-200 list-disc pl-5 space-y-0.5">
            {s.suggestions.map((sug, i) => (
              <li key={i}>{sug}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
