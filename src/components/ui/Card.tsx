import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}

export function Card({ title, description, actions, children, className = "", as = "section" }: CardProps) {
  const Component = as;
  return (
    <Component
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Component>
  );
}
