import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import {
  KeyRound, RefreshCw, Trash2, Copy, ShieldCheck, ShieldAlert, Clock,
} from "lucide-react";

interface Profile {
  id: string;
  name: string;
  kind: string;
  environment_id: string | null;
  config: Record<string, any>;
  masked_secrets: Record<string, string>;
  has_access_token: boolean;
  access_token_expires_at: string | null;
  created_at: string;
}

const KINDS = [
  "bearer",
  "api_key",
  "basic",
  "oauth2_client_credentials",
  "oauth2_authorization_code",
] as const;
type Kind = typeof KINDS[number];

const KIND_BADGE: Record<string, string> = {
  bearer:                       "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  api_key:                      "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  basic:                        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  oauth2_client_credentials:    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  oauth2_authorization_code:    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
};

const PRESETS: Record<Kind, { config: string; secrets: string; hint: string }> = {
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
  kind: "bearer" as Kind,
  config: PRESETS.bearer.config,
  secrets: PRESETS.bearer.secrets,
};

function formatExpiry(iso: string | null): { text: string; tone: "ok" | "soon" | "expired" | "none" } {
  if (!iso) return { text: "no token cached", tone: "none" };
  const exp = new Date(iso).getTime();
  const now = Date.now();
  const diff = exp - now;
  if (diff <= 0) return { text: "expired", tone: "expired" };
  const mins = Math.round(diff / 60000);
  if (mins < 60) return { text: `${mins}m left`, tone: mins < 5 ? "soon" : "ok" };
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return { text: `${hrs}h left`, tone: "ok" };
  return { text: `${Math.round(hrs / 24)}d left`, tone: "ok" };
}

export default function Vault() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [parseError, setParseError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: async () => (await api.get<Profile[]>("/vault")).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      setParseError(null);
      let config: any = {};
      let secrets: any = {};
      try {
        if (form.config.trim()) config = JSON.parse(form.config);
      } catch { throw new Error("Config must be valid JSON object"); }
      try {
        if (form.secrets.trim()) secrets = JSON.parse(form.secrets);
      } catch { throw new Error("Secrets must be valid JSON object"); }
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
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Failed to create profile";
      setParseError(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  const refresh = useMutation({
    mutationFn: async (id: string) => (await api.post(`/vault/${id}/refresh`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/vault/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
  });

  function applyKind(kind: Kind) {
    setForm((f) => ({
      ...f,
      kind,
      config: PRESETS[kind].config,
      secrets: PRESETS[kind].secrets,
    }));
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-title flex items-center gap-2">
            <KeyRound className="text-amber-500" /> Token Vault
          </h1>
          <p className="text-sm text-slate-500">
            Encrypted credential profiles · Fernet-encrypted at rest, never returned in plain text.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge-info">{tokenSummary.total} profiles</span>
          <span className="badge-success">{tokenSummary.withToken} cached</span>
          {tokenSummary.expiring > 0 && (
            <span className="badge-warn">{tokenSummary.expiring} expiring</span>
          )}
        </div>
      </div>

      {/* Create form */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm bg-gradient-brand bg-clip-text text-transparent">
          Add a credential profile
        </h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Profile name (e.g. zpe-prod)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="input"
            value={form.kind}
            onChange={(e) => applyKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <p className="text-xs text-slate-500 italic">{PRESETS[form.kind].hint}</p>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Config (JSON · stored as plain)</label>
            <textarea
              className="input font-mono text-xs mt-1 h-40"
              value={form.config}
              onChange={(e) => setForm({ ...form, config: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              Secrets (JSON · encrypted at rest)
            </label>
            <textarea
              className="input font-mono text-xs mt-1 h-40"
              value={form.secrets}
              onChange={(e) => setForm({ ...form, secrets: e.target.value })}
            />
          </div>
        </div>

        {parseError && <div className="text-sm text-rose-600">{parseError}</div>}

        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            disabled={!form.name || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Saving…" : "Create profile"}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => { setForm({ ...EMPTY_FORM }); setParseError(null); }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Profiles list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500
                            bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-2 py-2">Kind</th>
              <th className="px-2 py-2">Secrets (masked)</th>
              <th className="px-2 py-2">Token</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
            )}
            {!isLoading && (profiles?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                No credential profiles yet — add one above.
              </td></tr>
            )}
            {profiles?.map((p) => {
              const exp = formatExpiry(p.access_token_expires_at);
              const isRefreshing = refresh.isPending && refresh.variables === p.id;
              const isDeleting = del.isPending && del.variables === p.id;
              return (
                <tr key={p.id}
                    className="border-b border-slate-100 dark:border-slate-800
                               hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                      {p.id.slice(0, 8)}…
                      <button title="Copy ID" onClick={() => copy(p.id)}
                              className="text-slate-400 hover:text-brand-500">
                        <Copy size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span className={`badge ${KIND_BADGE[p.kind] ?? "badge-info"}`}>{p.kind}</span>
                  </td>
                  <td className="px-2 py-3 align-top font-mono text-xs space-y-0.5 max-w-xs">
                    {Object.keys(p.masked_secrets).length === 0
                      ? <span className="text-slate-400 italic">none</span>
                      : Object.entries(p.masked_secrets).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="text-slate-500">{k}:</span> {v}
                          </div>
                        ))}
                  </td>
                  <td className="px-2 py-3 align-top">
                    {p.has_access_token ? (
                      <span className={
                        "inline-flex items-center gap-1 text-xs " +
                        (exp.tone === "expired" ? "text-rose-600"
                          : exp.tone === "soon"  ? "text-amber-600"
                          : "text-emerald-600")
                      }>
                        {exp.tone === "expired"
                          ? <ShieldAlert size={12} />
                          : <Clock size={12} />}
                        {exp.text}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 align-top text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-secondary"
                        title="Force refresh token"
                        disabled={isRefreshing}
                        onClick={() => refresh.mutate(p.id)}
                      >
                        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                        <span className="ml-1">Refresh</span>
                      </button>
                      <button
                        className="btn-danger"
                        title="Delete profile"
                        disabled={isDeleting}
                        onClick={() => {
                          if (confirm(`Delete profile "${p.name}"? This cannot be undone.`)) {
                            del.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {refresh.isError && refresh.variables === p.id && (
                      <div className="mt-2 text-xs text-rose-600 text-right max-w-xs">
                        {(refresh.error as any)?.response?.data?.detail
                          ?? (refresh.error as any)?.message
                          ?? "Refresh failed"}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
