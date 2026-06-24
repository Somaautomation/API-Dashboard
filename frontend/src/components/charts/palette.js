/** Shared chart palette + helpers. */
export const PALETTE = [
    "#0ea5e9", // sky
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#14b8a6", // teal
    "#64748b", // slate
];
export const STATUS_COLORS = {
    Passed: "#10b981",
    Failed: "#ef4444",
    Skipped: "#94a3b8",
};
export function tooltipStyle() {
    return {
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 8,
        color: "#f1f5f9",
        fontSize: 12,
        padding: "8px 10px",
    };
}
