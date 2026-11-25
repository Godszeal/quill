"use client";

export function Toast({ message, type = "info", onDismiss }: { message: string; type?: "info" | "success" | "error"; onDismiss: () => void }) {
  const colors: Record<string, { bg: string; icon: string; text: string }> = {
    info: { bg: "#181818", icon: "ℹ️", text: "#ffffff" },
    success: { bg: "#15803d", icon: "✅", text: "#ffffff" },
    error: { bg: "#b91c1c", icon: "❌", text: "#ffffff" },
  };
  const c = colors[type];
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
      <span style={{ fontSize: "18px" }}>{c.icon}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 p-1 hover:opacity-70 transition-colors" aria-label="Dismiss">
        <span style={{ color: c.text }}>&times;</span>
      </button>
    </div>
  );
}
