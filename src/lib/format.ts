export const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export const fmtDateLong = (s: string | null | undefined) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n.toFixed(digits)}%`;

export const daysUntil = (date: string | null | undefined): number | null => {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((new Date(date).getTime() - now.getTime()) / 86400000);
};

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();