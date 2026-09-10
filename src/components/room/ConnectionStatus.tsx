import type { ConnectionState } from "@/hooks/useQuizRoom";

const DISPLAY: Record<ConnectionState, { icon: string; label: string; className: string }> = {
  connected: {
    icon: "🟢",
    label: "Connected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  connecting: {
    icon: "🟡",
    label: "Connecting…",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  reconnecting: {
    icon: "🟡",
    label: "Reconnecting…",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  disconnected: {
    icon: "🔴",
    label: "Disconnected",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const { icon, label, className } = DISPLAY[state];
  return (
    <p
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <span aria-hidden="true" className="text-[10px]">
        {icon}
      </span>
      {label}
    </p>
  );
}
