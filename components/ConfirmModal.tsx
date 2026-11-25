"use client";

export function ConfirmModal({
  open,
  title,
  content,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDark,
}: {
  open: boolean;
  title: string;
  content: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}) {
  if (!open) return null;
  const bg = isDark ? "#161616" : "#ffffff";
  const textPrimary = isDark ? "#ffffff" : "#181818";
  const textSecondary = isDark ? "#a1a1aa" : "#666666";
  const borderColor = isDark ? "#2a2a2a" : "#e5e5e5";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 rounded-xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: bg, borderColor, color: textPrimary }}
      >
        <div className="p-6 border-b" style={{ borderColor }}>
          <h2 className="text-lg font-semibold" style={{ color: textPrimary }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: textSecondary }}>
            {content}
          </p>
        </div>
        <div className="p-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: textSecondary, border: `1px solid ${borderColor}`, backgroundColor: "transparent" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
