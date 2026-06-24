import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "@/components/Shell";
import { RequireAuth } from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SwaggerUpload from "@/pages/SwaggerUpload";
import Collections from "@/pages/Collections";
import Automation from "@/pages/Automation";
import LoadTest from "@/pages/LoadTest";
import Runs from "@/pages/Runs";
import Vault from "@/pages/Vault";
import Mocks from "@/pages/Mocks";
import AIAssist from "@/pages/AIAssist";
import Reports from "@/pages/Reports";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(RequireAuth, { children: _jsx(Shell, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "swagger", element: _jsx(SwaggerUpload, {}) }), _jsx(Route, { path: "collections", element: _jsx(Collections, {}) }), _jsx(Route, { path: "automation", element: _jsx(Automation, {}) }), _jsx(Route, { path: "loadtest", element: _jsx(LoadTest, {}) }), _jsx(Route, { path: "runs", element: _jsx(Runs, {}) }), _jsx(Route, { path: "vault", element: _jsx(Vault, {}) }), _jsx(Route, { path: "mocks", element: _jsx(Mocks, {}) }), _jsx(Route, { path: "ai", element: _jsx(AIAssist, {}) }), _jsx(Route, { path: "reports", element: _jsx(Reports, {}) }), _jsx(Route, { path: "analytics", element: _jsx(Analytics, {}) }), _jsx(Route, { path: "settings", element: _jsx(Settings, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
