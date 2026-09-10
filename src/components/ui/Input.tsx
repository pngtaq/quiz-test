"use client";

import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** "code" renders a large, monospaced field for room codes. */
  inputSize?: "md" | "code";
}

const SIZE_CLASSES = {
  md: "h-11",
  code: "h-14 text-center font-mono text-2xl font-bold uppercase tracking-[0.3em]",
};

export const FIELD_CLASSES =
  "block w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 shadow-sm transition " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100";

export function Input({ label, hint, error, id, inputSize = "md", className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${FIELD_CLASSES} ${SIZE_CLASSES[inputSize]} ${error ? "border-red-400" : "border-slate-300"} ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
