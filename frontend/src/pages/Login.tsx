import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function Login() {
  const [email, setEmail] = useState("admin@zpesystems.com");
  const [password, setPassword] = useState("ChangeMe!123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setTokens(data.access_token, data.refresh_token);
      const me = await api.get("/users/me");
      setUser(me.data);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-brand p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 10% 10%, rgba(255,255,255,0.35), transparent 60%)," +
            "radial-gradient(700px 350px at 90% 90%, rgba(255,255,255,0.25), transparent 60%)",
        }}
      />
      <form
        onSubmit={submit}
        className="relative card p-8 w-full max-w-sm space-y-4 shadow-glow"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-brand grid place-items-center text-white font-bold shadow-glow">
            Z
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-brand bg-clip-text text-transparent">
              ZPE API Testing
            </h1>
            <p className="text-xs text-slate-500">Sign in to continue</p>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Email</label>
          <input className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Password</label>
          <input type="password" className="input mt-1" value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-[11px] text-slate-400 text-center">
          Secured by ZPE Systems · Enterprise QA
        </p>
      </form>
    </div>
  );
}
