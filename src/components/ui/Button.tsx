import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface StyleOptions {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800",
  secondary: "border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: StyleOptions = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  loading = false,
  loadingText,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

interface ButtonLinkProps extends StyleOptions {
  href: string;
  children: ReactNode;
}

export function ButtonLink({ href, children, ...style }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(style)}>
      {children}
    </Link>
  );
}
