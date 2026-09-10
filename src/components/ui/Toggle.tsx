"use client";

import { useId } from "react";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Accessible on/off switch. State is conveyed by text and knob position, not just color. */
export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="w-7 text-right text-xs font-medium text-slate-600" aria-hidden="true">
          {checked ? "On" : "Off"}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            checked ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
