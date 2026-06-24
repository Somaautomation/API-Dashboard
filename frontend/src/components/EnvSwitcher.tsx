import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";

interface Env {
  id: string;
  name: string;
  kind: "dev" | "qa" | "stage" | "prod" | "custom";
  base_url: string;
}

const KIND_BADGE: Record<Env["kind"], string> = {
  dev:    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  qa:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  stage:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  prod:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  custom: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
};

export default function EnvSwitcher() {
  const { selectedId, set } = useActiveEnv();
  const { data: envs } = useQuery({
    queryKey: ["env-switcher"],
    queryFn: async () => (await api.get<Env[]>("/environments")).data,
    staleTime: 60_000,
  });

  const list = envs ?? [];
  const active = list.find((e) => e.id === selectedId) ?? list[0];

  return (
    <div className="flex items-center gap-2">
      <Globe size={14} className="text-sky-500" />
      <select
        className="text-xs rounded-md border border-slate-300 dark:border-slate-700
                   bg-white/80 dark:bg-slate-800/80 px-2 py-1
                   focus:outline-none focus:ring-2 focus:ring-brand-400"
        value={active?.id ?? ""}
        onChange={(e) => set(e.target.value || null)}
        title={active?.base_url ?? "No environment selected"}
      >
        <option value="">— No env —</option>
        {list.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.base_url.replace(/^https?:\/\//, "")}
          </option>
        ))}
      </select>
      {active && (
        <span className={`badge ${KIND_BADGE[active.kind]}`}>{active.kind}</span>
      )}
    </div>
  );
}
