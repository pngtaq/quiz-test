"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { FIELD_CLASSES } from "./Input";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
}

export function Select({ label, options, hint, id, className = "", ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={selectId}
        aria-describedby={hint ? hintId : undefined}
        className={`${FIELD_CLASSES} h-11 border-slate-300 pr-8 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
