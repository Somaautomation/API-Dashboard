import { useEffect, useState } from "react";
import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number | string;
  suffix?: string;
  icon?: LucideIcon;
  accent?: "sky" | "emerald" | "amber" | "rose" | "violet" | "slate";
  help?: string;
}

const ACCENTS: Record<string, { bg: string; text: string; ring: string }> = {
  sky:     { bg: "bg-sky-50 dark:bg-sky-900/20",     text: "text-sky-600 dark:text-sky-300",     ring: "ring-sky-200/60 dark:ring-sky-900/40" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-200/60 dark:ring-emerald-900/40" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-300", ring: "ring-amber-200/60 dark:ring-amber-900/40" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-900/20",   text: "text-rose-600 dark:text-rose-300",   ring: "ring-rose-200/60 dark:ring-rose-900/40" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-300", ring: "ring-violet-200/60 dark:ring-violet-900/40" },
  slate:   { bg: "bg-slate-50 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-300", ring: "ring-slate-200/60 dark:ring-slate-800" },
};

function useCount(target: number, durationMs = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || !isFinite(target)) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setV(target * (0.5 - Math.cos(Math.PI * p) / 2));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

export default function KpiCard({ label, value, suffix, icon: Icon, accent = "sky", help }: Props) {
  const a = ACCENTS[accent];
  const numeric = typeof value === "number" ? value : Number(value);
  const animated = useCount(isNaN(numeric) ? 0 : numeric);
  const display = typeof value === "number"
    ? (Number.isInteger(value) ? Math.round(animated).toLocaleString() : animated.toFixed(2))
    : value;

  return (
    <div className={`card p-4 ring-1 ${a.ring} hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
        {Icon && (
          <div className={`h-8 w-8 rounded-lg ${a.bg} ${a.text} grid place-items-center`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">
        {display}
        {suffix && <span className="text-base font-medium text-slate-500 ml-1">{suffix}</span>}
      </div>
      {help && <div className="text-[11px] text-slate-500 mt-1">{help}</div>}
    </div>
  );
}
