const COLORS = [
  "bg-indigo-600",
  "bg-emerald-700",
  "bg-rose-600",
  "bg-amber-700",
  "bg-sky-700",
  "bg-violet-600",
  "bg-teal-700",
  "bg-fuchsia-700",
];

function colorFor(nickname: string): string {
  let hash = 0;
  for (const char of nickname) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return COLORS[hash % COLORS.length] as string;
}

interface PlayerAvatarProps {
  nickname: string;
  dimmed?: boolean;
  size?: "sm" | "md";
}

/** Decorative initial badge; the nickname itself is always rendered next to it. */
export function PlayerAvatar({ nickname, dimmed = false, size = "md" }: PlayerAvatarProps) {
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? "?";
  const dimensions = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${dimensions} ${colorFor(nickname)} ${
        dimmed ? "opacity-40 grayscale" : ""
      }`}
    >
      {initial}
    </span>
  );
}
