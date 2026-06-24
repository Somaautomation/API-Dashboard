import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, right, children, className = "" }: Props) {
  return (
    <div className={`card p-4 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-[260px]">{children}</div>
    </div>
  );
}
