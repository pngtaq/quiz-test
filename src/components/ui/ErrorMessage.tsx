import type { ReactNode } from "react";

interface ErrorMessageProps {
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({ title, message, action, onDismiss, className = "" }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 ${className}`}
    >
      <span aria-hidden="true" className="text-lg leading-6">
        ⚠️
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-sm">{message}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="h-7 w-7 shrink-0 rounded-lg text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Dismiss message"
        >
          ✕
        </button>
      )}
    </div>
  );
}
