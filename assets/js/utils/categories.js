/**
 * categories.js - colours and emoji for categories and goals.
 * These are purely visual, so they live in the frontend
 * instead of the Category class on the backend.
 */

const KNOWN = {
  housing: { color: "#6366f1", emoji: "🏠" },
  rent: { color: "#6366f1", emoji: "🏠" },
  food: { color: "#3bb36a", emoji: "🛒" },
  transport: { color: "#f0a23a", emoji: "🚗" },
  utilities: { color: "#8b5cf6", emoji: "💡" },
  entertainment: { color: "#e05555", emoji: "🎬" },
  lifestyle: { color: "#ec4899", emoji: "🛍️" },
  health: { color: "#14b8a6", emoji: "🩺" },
  education: { color: "#0ea5e9", emoji: "📚" },
  salary: { color: "#3bb36a", emoji: "💰" },
  freelance: { color: "#0ea5e9", emoji: "💼" },
  other: { color: "#94a3b8", emoji: "📦" },
};

const FALLBACK = ["#6366f1", "#3bb36a", "#f0a23a", "#8b5cf6", "#e05555", "#0ea5e9", "#94a3b8"];

function lookup(name = "") {
  const key = Object.keys(KNOWN).find((k) => name.toLowerCase().includes(k));
  return key ? KNOWN[key] : null;
}

export function categoryColor(name, index = 0) {
  return lookup(name)?.color || FALLBACK[index % FALLBACK.length];
}

export function categoryEmoji(name) {
  return lookup(name)?.emoji || "📦";
}

const GOAL_ICONS = [
  ["emergency", "🛟"],
  ["laptop", "💻"],
  ["computer", "💻"],
  ["phone", "📱"],
  ["holiday", "✈️"],
  ["vacation", "🌴"],
  ["travel", "✈️"],
  ["car", "🚗"],
  ["house", "🏡"],
  ["home", "🏡"],
  ["school", "🎓"],
  ["fees", "🎓"],
  ["wedding", "💍"],
];

export function goalEmoji(name = "") {
  const lower = name.toLowerCase();
  return GOAL_ICONS.find(([k]) => lower.includes(k))?.[1] || "🎯";
}

/** Green under 75%, amber from 75%, red from 90% (nearly or already over). */
export function usageColor(pct) {
  if (pct >= 90) return "var(--danger)";
  if (pct >= 75) return "var(--warning)";
  return "var(--success)";
}
