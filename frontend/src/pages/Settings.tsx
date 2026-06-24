import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";

interface EnvOut {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  variables: Record<string, string>;
}

const KINDS = ["dev", "qa", "stage", "prod", "custom"];

function safeParseJson(text: string): Record<string, string> {
  const t = text.trim();
  if (!t) return {};
  const obj = JSON.parse(t);
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
  }
  throw new Error("Variables must be a JSON object of strings");
}

function EnvForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: EnvOut;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "dev");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "");
  const [varsText, setVarsText] = useState(
    JSON.stringify(initial?.variables ?? {}, null, 2)
  );
  const [err, setErr] = useState<string | null>(null);

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
        return (await api.put(`/environments/${initial!.id}`, payload)).data;
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
    onError: (e: any) => setErr(e?.response?.data?.detail ?? e.message ?? "Failed"),
  });

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50/60 dark:bg-slate-800/30">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {isEdit ? "Edit environment" : "New environment"}
        </div>
        {onCancel && (
          <button className="text-xs text-slate-500 hover:underline ml-auto" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2">
        <input
          className="input"
          placeholder="Name (e.g. ZPECloud QA)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div>
        <label className="text-[11px] text-slate-500">Base URL (becomes {`{{baseUrl}}`})</label>
        <input
          className="input"
          placeholder="https://api.qa-zpecloud.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[11px] text-slate-500">
          Variables (JSON object) — used as {`{{key}}`} in URL/headers/body
        </label>
        <textarea
          className="input font-mono text-xs h-32"
          placeholder='{"token":"abc","userId":"42"}'
          value={varsText}
          onChange={(e) => setVarsText(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn-primary ml-auto"
          disabled={!name || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : isEdit ? "Save" : "Create"}
        </button>
      </div>

      {err && <div className="text-xs text-red-600 whitespace-pre-wrap">{err}</div>}
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: envs } = useQuery({
    queryKey: ["envs"],
    queryFn: async () => (await api.get<EnvOut[]>("/environments")).data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/environments/${id}`),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["envs"] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card p-4">
        <div className="text-sm font-medium mb-2">Current user</div>
        <pre className="text-xs font-mono">{JSON.stringify(user, null, 2)}</pre>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">Global environments &amp; variables</div>
          <div className="text-xs text-slate-500">
            Use <code>{`{{baseUrl}}`}</code> and <code>{`{{anyVar}}`}</code> in request URLs, headers and body — they're
            substituted at run time from the selected environment.
          </div>
        </div>

        {envs && envs.length > 0 ? (
          <div className="space-y-2">
            {envs.map((e) => {
              const editing = editingId === e.id;
              return (
                <div key={e.id} className="border border-slate-200 dark:border-slate-700 rounded-md">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="badge bg-slate-100 dark:bg-slate-800 text-[10px] uppercase">{e.kind}</span>
                    <span className="font-semibold">{e.name}</span>
                    <span className="font-mono text-xs text-slate-500 truncate flex-1" title={e.base_url}>
                      {e.base_url || "(no base URL)"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {Object.keys(e.variables ?? {}).length} var(s)
                    </span>
                    <button
                      className="text-slate-600 dark:text-slate-300 hover:underline text-[11px]"
                      onClick={() => setEditingId(editing ? null : e.id)}
                    >
                      {editing ? "Close" : "Edit"}
                    </button>
                    <button
                      className="text-rose-600 hover:underline text-[11px]"
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm(`Delete environment "${e.name}"?`)) del.mutate(e.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  {editing && (
                    <div className="px-3 pb-3">
                      <EnvForm
                        initial={e}
                        onCancel={() => setEditingId(null)}
                        onDone={() => {
                          setEditingId(null);
                          qc.invalidateQueries({ queryKey: ["envs"] });
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">No environments yet — create one below.</div>
        )}

        <EnvForm onDone={() => qc.invalidateQueries({ queryKey: ["envs"] })} />
      </div>
    </div>
  );
}
