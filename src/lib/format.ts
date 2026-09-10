const numberFormat = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export const ANSWER_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export function answerLetter(index: number): string {
  return ANSWER_LETTERS[index] ?? String(index + 1);
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
