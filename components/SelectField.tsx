"use client";

import { ChevronDown } from "lucide-react";

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-paper py-2.5 pl-3 pr-9 text-sm text-ink outline-none transition focus:border-ink"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-paper text-ink">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}
