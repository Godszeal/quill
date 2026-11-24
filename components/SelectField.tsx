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
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-wider font-semibold text-[#666] block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2.5 text-sm text-[#181818] outline-none focus:ring-2 focus:ring-[#181818] appearance-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-[#666]" />
      </div>
    </div>
  );
}
