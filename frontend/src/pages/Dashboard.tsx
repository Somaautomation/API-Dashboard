import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface Overview {
  total_runs: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_duration_ms: number;
  trend: { date: string; passed: number; failed: number }[];
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => (await api.get<Overview>("/reports/overview")).data,
  });

  if (isLoading || !data) return <div className="text-sm text-slate-500">Loading metrics…</div>;

  const stats = [
    { label: "Total runs (30d)", value: data.total_runs,                       gradient: "bg-gradient-sky" },
    { label: "Pass rate",        value: `${(data.pass_rate * 100).toFixed(1)}%`, gradient: "bg-gradient-mint" },
    { label: "Passed",           value: data.passed,                           gradient: "bg-gradient-mint" },
    { label: "Failed",           value: data.failed,                           gradient: "bg-gradient-sunset" },
    { label: "Avg duration",     value: `${Math.round(data.avg_duration_ms)} ms`, gradient: "bg-gradient-brand" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-title">ZPE CLOUD Platform overview</h1>
        <p className="text-sm text-slate-500">Last 30 days of execution telemetry</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`card-gradient ${s.gradient}`}>
            <div className="text-xs uppercase tracking-wide text-white/80">{s.label}</div>
            <div className="text-3xl font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <div className="text-sm font-semibold mb-2 bg-gradient-brand bg-clip-text text-transparent">Pass / Fail trend</div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5, 10)} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
