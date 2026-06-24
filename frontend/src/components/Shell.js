import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, UploadCloud, FolderTree, KeyRound, ServerCog, ListChecks, FileBarChart2, Settings, Moon, Sun, LogOut, Sparkles, BarChart3, Workflow, Activity } from "lucide-react";
import { useTheme } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import EnvSwitcher from "@/components/EnvSwitcher";
const NAV = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, color: "text-sky-300" },
    { to: "/swagger", label: "Swagger Upload", icon: UploadCloud, color: "text-emerald-300" },
    { to: "/collections", label: "Collections", icon: FolderTree, color: "text-violet-300" },
    { to: "/automation", label: "API Automation", icon: Workflow, color: "text-lime-300" },
    { to: "/loadtest", label: "Load Testing", icon: Activity, color: "text-cyan-300" },
    { to: "/runs", label: "Execution Reports", icon: ListChecks, color: "text-amber-300" },
    { to: "/vault", label: "Token Vault", icon: KeyRound, color: "text-rose-300" },
    { to: "/mocks", label: "Mock APIs", icon: ServerCog, color: "text-fuchsia-300" },
    { to: "/ai", label: "AI Assist", icon: Sparkles, color: "text-yellow-300" },
    { to: "/analytics", label: "Analytics", icon: BarChart3, color: "text-cyan-300" },
    { to: "/reports", label: "Reports", icon: FileBarChart2, color: "text-teal-300" },
    { to: "/settings", label: "Settings", icon: Settings, color: "text-slate-300" },
];
export default function Shell() {
    const { theme, toggle } = useTheme();
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("aside", { className: "w-64 shrink-0 bg-gradient-shell text-white flex flex-col relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 opacity-30 pointer-events-none", style: {
                            backgroundImage: "radial-gradient(420px 220px at 20% 10%, rgba(255,255,255,0.35), transparent 60%)," +
                                "radial-gradient(420px 220px at 80% 90%, rgba(255,255,255,0.20), transparent 60%)",
                        } }), _jsx("div", { className: "relative px-5 py-5 border-b border-white/10", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-9 w-9 rounded-lg bg-white/15 backdrop-blur grid place-items-center font-bold", children: "Z" }), _jsxs("div", { children: [_jsx("div", { className: "text-lg font-bold leading-none", children: "ZPE" }), _jsx("div", { className: "text-[11px] text-white/70", children: "API Testing Platform" })] })] }) }), _jsx("nav", { className: "relative flex-1 px-2 py-3 space-y-1", children: NAV.map(({ to, label, icon: Icon, color }) => (_jsxs(NavLink, { to: to, end: to === "/", className: ({ isActive }) => cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all", isActive
                                ? "bg-white/20 text-white shadow-inner"
                                : "text-white/80 hover:bg-white/10 hover:text-white"), children: [_jsx(Icon, { size: 16, className: color }), label] }, to))) }), _jsx("div", { className: "relative border-t border-white/10 p-3 text-[11px] text-white/60", children: "v1.0.0 \u00B7 \u00A9 ZPE Systems" })] }), _jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsxs("header", { className: "h-14 border-b border-slate-200/70 dark:border-slate-800\r\n                           bg-white/70 dark:bg-slate-900/70 backdrop-blur\r\n                           flex items-center justify-between px-6", children: [_jsxs("div", { className: "text-sm font-medium", children: [_jsx("span", { className: "bg-gradient-brand bg-clip-text text-transparent", children: "Enterprise QA" }), _jsx("span", { className: "text-slate-400", children: " \u00B7 API Governance" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(EnvSwitcher, {}), _jsx("div", { className: "w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" }), _jsx("button", { className: "btn-ghost", onClick: toggle, title: "Toggle theme", children: theme === "dark"
                                            ? _jsx(Sun, { size: 16, className: "text-amber-400" })
                                            : _jsx(Moon, { size: 16, className: "text-indigo-500" }) }), _jsxs("div", { className: "text-sm hidden sm:flex items-center gap-2", children: [_jsx("span", { children: user?.full_name || user?.email }), _jsx("span", { className: "badge-brand", children: user?.role })] }), _jsx("button", { className: "btn-ghost", onClick: () => { logout(); navigate("/login"); }, title: "Log out", children: _jsx(LogOut, { size: 16, className: "text-rose-500" }) })] })] }), _jsx("main", { className: "flex-1 overflow-auto p-6", children: _jsx(Outlet, {}) })] })] }));
}
