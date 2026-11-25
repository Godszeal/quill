"use client";

export function Toast({ message, type = "info", onDismiss }: { message: string; type?: "info" | "success" | "error"; onDismiss: () => void }) {
  const iconMap: Record<string, string> = {
    info: "fa-info-circle",
    success: "fa-check-circle",
    error: "fa-times-circle",
  };
  const colors: Record<string, { bg: string; text: string }> = {
    info: { bg: "#181818", text: "#ffffff" },
    success: { bg: "#15803d", text: "#ffffff" },
    error: { bg: "#b91c1c", text: "#ffffff" },
  };
  const c = colors[type];
  const iconClass = iconMap[type];
  const isDark = document.documentElement.classList.contains("dark");
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 transform translate-y-0"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      }}
    >
      <i className={`fa ${iconClass} fa-lg`} aria-hidden="true" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 p-1 hover:opacity-70 transition-colors" aria-label="Dismiss">
        <span style={{ color: c.text }}>&times;</span>
      </button>
    </div>
  );
}
