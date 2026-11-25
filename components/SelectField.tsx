"use client";

import { ChevronDown } from "lucide-react";

export function SelectField({
  label,
  value,
  onChange,
  options,
  isDark,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  isDark?: boolean;
}) {
  const c = {
    labelColor: isDark ? "#a1a1aa" : "#666666",
    bg: isDark ? "#1f1f1f" : "#ffffff",
    border: isDark ? "#2a2a2a" : "#e5e5e5",
    text: isDark ? "#ffffff" : "#181818",
    chevron: isDark ? "#a1a1aa" : "#666666",
  };
  return (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-wider font-semibold block" style={{ color: c.labelColor }}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus-ring-[#3b82f6] appearance-none cursor-pointer"
          style={{
            backgroundColor: c.bg,
            borderColor: c.border,
            color: c.text,
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ backgroundColor: c.bg, color: c.text }}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2" style={{ color: c.chevron }} />
      </div>
    </div>
  );
}
