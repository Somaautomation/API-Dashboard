import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useActiveEnv } from "@/store/env";
const KIND_BADGE = {
    dev: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    qa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    stage: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    prod: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
    custom: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
};
export default function EnvSwitcher() {
    const { selectedId, set } = useActiveEnv();
    const { data: envs } = useQuery({
        queryKey: ["env-switcher"],
        queryFn: async () => (await api.get("/environments")).data,
        staleTime: 60_000,
    });
    const list = envs ?? [];
    const active = list.find((e) => e.id === selectedId) ?? list[0];
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Globe, { size: 14, className: "text-sky-500" }), _jsxs("select", { className: "text-xs rounded-md border border-slate-300 dark:border-slate-700\r\n                   bg-white/80 dark:bg-slate-800/80 px-2 py-1\r\n                   focus:outline-none focus:ring-2 focus:ring-brand-400", value: active?.id ?? "", onChange: (e) => set(e.target.value || null), title: active?.base_url ?? "No environment selected", children: [_jsx("option", { value: "", children: "\u2014 No env \u2014" }), list.map((e) => (_jsxs("option", { value: e.id, children: [e.name, " \u00B7 ", e.base_url.replace(/^https?:\/\//, "")] }, e.id)))] }), active && (_jsx("span", { className: `badge ${KIND_BADGE[active.kind]}`, children: active.kind }))] }));
}
