export function formatNGN(amount: number | string | null | undefined, opts?: { compact?: boolean }) {
  const n = Number(amount ?? 0);
  if (opts?.compact && Math.abs(n) >= 1_000_000) {
    return "₦" + (n / 1_000_000).toFixed(1) + "M";
  }
  if (opts?.compact && Math.abs(n) >= 1_000) {
    return "₦" + (n / 1_000).toFixed(1) + "k";
  }
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}
