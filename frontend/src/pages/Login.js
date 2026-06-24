import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
export default function Login() {
    const [email, setEmail] = useState("admin@zpesystems.com");
    const [password, setPassword] = useState("ChangeMe!123");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setTokens, setUser } = useAuthStore();
    async function submit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { data } = await api.post("/auth/login", { email, password });
            setTokens(data.access_token, data.refresh_token);
            const me = await api.get("/users/me");
            setUser(me.data);
            navigate("/");
        }
        catch (err) {
            setError(err?.response?.data?.error?.message ?? "Login failed");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "min-h-screen grid place-items-center bg-gradient-brand p-6 relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 opacity-40 pointer-events-none", style: {
                    backgroundImage: "radial-gradient(600px 300px at 10% 10%, rgba(255,255,255,0.35), transparent 60%)," +
                        "radial-gradient(700px 350px at 90% 90%, rgba(255,255,255,0.25), transparent 60%)",
                } }), _jsxs("form", { onSubmit: submit, className: "relative card p-8 w-full max-w-sm space-y-4 shadow-glow", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-11 w-11 rounded-xl bg-gradient-brand grid place-items-center text-white font-bold shadow-glow", children: "Z" }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold bg-gradient-brand bg-clip-text text-transparent", children: "ZPE API Testing" }), _jsx("p", { className: "text-xs text-slate-500", children: "Sign in to continue" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Email" }), _jsx("input", { className: "input mt-1", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500", children: "Password" }), _jsx("input", { type: "password", className: "input mt-1", value: password, onChange: (e) => setPassword(e.target.value) })] }), error && _jsx("div", { className: "text-sm text-rose-600", children: error }), _jsx("button", { type: "submit", className: "btn-primary w-full", disabled: loading, children: loading ? "Signing in…" : "Sign in" }), _jsx("p", { className: "text-[11px] text-slate-400 text-center", children: "Secured by ZPE Systems \u00B7 Enterprise QA" })] })] }));
}
