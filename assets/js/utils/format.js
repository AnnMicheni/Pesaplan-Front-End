/**
 * format.js - money, percentage and date formatting.
 * Money uses the user's currency and "compact number" preference
 * (Settings > General), so every screen formats amounts the same way.
 */
import { session } from "../core/session.js";

const SYMBOLS = {
  KES: "KSh",
  UGX: "USh",
  TZS: "TSh",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const CURRENCIES = [
  { code: "KES", name: "Kenyan Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];

function prefs() {
  const user = session.getUser() || {};
  return { currency: user.currency || "KES", compact: Boolean(user.compactNumbers) };
}

export function currencySymbol(code = prefs().currency) {
  return SYMBOLS[code] || code;
}

/**
 * money(125000)                  -> "KSh 125,000"
 * money(125000, { compact: true }) -> "KSh 125k"
 * money(4250, { sign: true, type: "INCOME" }) -> "+KSh 4,250"
 */
export function money(amount, options = {}) {
  const p = prefs();
  const currency = options.currency || p.currency;
  const compact = options.compact ?? p.compact;
  const value = Number(amount) || 0;
  const abs = Math.abs(value);

  let body;
  if (compact && abs >= 1000) {
    body = new Intl.NumberFormat("en-KE", {
      notation: "compact",
      maximumFractionDigits: 1,
    })
      .format(abs)
      .toLowerCase();
  } else {
    body = new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: options.decimals ?? 0,
      maximumFractionDigits: options.decimals ?? 0,
    }).format(abs);
  }

  let prefix = "";
  if (options.sign && options.type === "INCOME") prefix = "+";
  else if (value < 0) prefix = "-";

  return `${prefix}${currencySymbol(currency)} ${body}`;
}

/** Short axis label: 75000 -> "75k" */
export function shortNumber(value) {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1000) return `${+(value / 1000).toFixed(0)}k`;
  return String(value);
}

export function percent(value, decimals = 0) {
  return `${(Number(value) || 0).toFixed(decimals)}%`;
}

/** "2026-11-18" -> "Nov 18, 2026" */
export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "2026-11-18" -> "Due Nov 2026" style label */
export function monthYear(iso) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Today's date as "YYYY-MM-DD" in local time. */
export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Current period as "YYYY-MM" (matches Java YearMonth.toString()). */
export function currentPeriod() {
  return todayIso().slice(0, 7);
}

/** "2026-11" -> "November 2026" */
export function periodLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-11" -> "Nov" */
export function periodShort(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

/** The last `count` periods ending with the current one, oldest first. */
export function lastPeriods(count, from = currentPeriod()) {
  const [y, m] = from.split("-").map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function initials(user) {
  if (!user) return "?";
  const a = (user.firstName || "").charAt(0);
  const b = (user.lastName || "").charAt(0);
  return (a + b).toUpperCase() || "?";
}
