import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
export function RequireAuth({ children }) {
    const token = useAuthStore((s) => s.accessToken);
    const location = useLocation();
    if (!token)
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location } });
    return _jsx(_Fragment, { children: children });
}
