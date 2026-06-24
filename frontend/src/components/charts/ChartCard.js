import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ChartCard({ title, subtitle, right, children, className = "" }) {
    return (_jsxs("div", { className: `card p-4 flex flex-col ${className}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold", children: title }), subtitle && _jsx("div", { className: "text-xs text-slate-500 mt-0.5", children: subtitle })] }), right] }), _jsx("div", { className: "flex-1 min-h-[260px]", children: children })] }));
}
