import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, UploadCloud, FolderTree, KeyRound, ServerCog,
  ListChecks, FileBarChart2, Settings, Moon, Sun, LogOut, Sparkles, BarChart3, Workflow, Activity
} from "lucide-react";
import { useTheme } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import EnvSwitcher from "@/components/EnvSwitcher";

const NAV = [
  { to: "/",            label: "Dashboard",         icon: LayoutDashboard, color: "text-sky-300"     },
  { to: "/swagger",     label: "Swagger Upload",    icon: UploadCloud,     color: "text-emerald-300" },
  { to: "/collections", label: "Collections",       icon: FolderTree,      color: "text-violet-300"  },
  { to: "/automation",  label: "API Automation",    icon: Workflow,        color: "text-lime-300"    },
  { to: "/loadtest",     label: "Load Testing",     icon: Activity,        color: "text-cyan-300"    },
  { to: "/runs",        label: "Execution Reports", icon: ListChecks,      color: "text-amber-300"   },
  { to: "/vault",       label: "Token Vault",       icon: KeyRound,        color: "text-rose-300"    },
  { to: "/mocks",       label: "Mock APIs",         icon: ServerCog,       color: "text-fuchsia-300" },
  { to: "/ai",          label: "AI Assist",         icon: Sparkles,        color: "text-yellow-300"  },
  { to: "/analytics",   label: "Analytics",         icon: BarChart3,       color: "text-cyan-300"    },
  { to: "/reports",     label: "Reports",           icon: FileBarChart2,   color: "text-teal-300"    },
  { to: "/settings",    label: "Settings",          icon: Settings,        color: "text-slate-300"   },
];

export default function Shell() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-gradient-shell text-white flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(420px 220px at 20% 10%, rgba(255,255,255,0.35), transparent 60%)," +
              "radial-gradient(420px 220px at 80% 90%, rgba(255,255,255,0.20), transparent 60%)",
          }}
        />
        <div className="relative px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-white/15 backdrop-blur grid place-items-center font-bold">Z</div>
            <div>
              <div className="text-lg font-bold leading-none">ZPE</div>
              <div className="text-[11px] text-white/70">API Testing Platform</div>
            </div>
          </div>
        </div>
        <nav className="relative flex-1 px-2 py-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon, color }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                  isActive
                    ? "bg-white/20 text-white shadow-inner"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Icon size={16} className={color} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="relative border-t border-white/10 p-3 text-[11px] text-white/60">
          v1.0.0 · © ZPE Systems
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200/70 dark:border-slate-800
                           bg-white/70 dark:bg-slate-900/70 backdrop-blur
                           flex items-center justify-between px-6">
          <div className="text-sm font-medium">
            <span className="bg-gradient-brand bg-clip-text text-transparent">Enterprise QA</span>
            <span className="text-slate-400"> · API Governance</span>
          </div>
          <div className="flex items-center gap-2">
            <EnvSwitcher />
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button className="btn-ghost" onClick={toggle} title="Toggle theme">
              {theme === "dark"
                ? <Sun size={16} className="text-amber-400" />
                : <Moon size={16} className="text-indigo-500" />}
            </button>
            <div className="text-sm hidden sm:flex items-center gap-2">
              <span>{user?.full_name || user?.email}</span>
              <span className="badge-brand">{user?.role}</span>
            </div>
            <button
              className="btn-ghost"
              onClick={() => { logout(); navigate("/login"); }}
              title="Log out"
            >
              <LogOut size={16} className="text-rose-500" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

