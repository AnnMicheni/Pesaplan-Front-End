/**
 * mock-server.js - a fake backend that runs in the browser.
 *
 * It answers exactly the same URLs, with exactly the same JSON shapes,
 * as the Java backend must (see docs/API.md). That makes it two things:
 *   1. a way to build and demo the frontend before the backend exists
 *   2. a living example of the API contract for the backend team
 *
 * Data is kept in sessionStorage, so changes survive page navigation
 * until the tab is closed. Call resetMockData() to start over.
 */
import { ApiError } from "../errors.js";
import { createSeed } from "./seed.js";

const KEY = "pfm.mockdb";
let memory = null;

function load() {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {
    /* ignore and reseed */
  }
  if (!memory) {
    memory = createSeed();
    save();
  }
  return memory;
}

function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* in-memory only */
  }
}

export function resetMockData() {
  memory = createSeed();
  save();
}

/* ---------- helpers ---------- */

const db = () => load();
const newId = () => db().nextId++;
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);
const change = (now, before) => (before > 0 ? round2(((now - before) / before) * 100) : null);

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftPeriod(period, months) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function notFound(what) {
  return new ApiError(404, `${what} not found`);
}

function invalid(fields) {
  return new ApiError(400, "Please check the highlighted fields.", fields);
}

function requireUser(token) {
  const match = /^mock-token-(\d+)$/.exec(token || "");
  const user = match && db().users.find((u) => u.id === Number(match[1]));
  if (!user) throw new ApiError(401, "Please log in again.");
  if (user.status === "SUSPENDED") throw new ApiError(403, "This account has been suspended.");
  return user;
}

function publicUser(user) {
  const { ...copy } = user;
  return copy;
}

function category(id) {
  return db().categories.find((c) => c.id === Number(id));
}

function withCategory(t) {
  return { ...t, categoryName: category(t.categoryId)?.name || "Uncategorised" };
}

function userTransactions(userId) {
  return db().transactions.filter((t) => t.userId === userId);
}

/** Mirrors User.getTotalSpent(category, period) on the backend. */
function spentIn(userId, categoryId, period) {
  return userTransactions(userId)
    .filter((t) => t.type === "EXPENSE" && t.categoryId === categoryId && t.date.startsWith(period))
    .reduce((s, t) => s + t.amount, 0);
}

function totalsFor(userId, period) {
  let income = 0;
  let expenses = 0;
  for (const t of userTransactions(userId)) {
    if (!t.date.startsWith(period)) continue;
    if (t.type === "INCOME") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses };
}

function goalView(goal) {
  const contributions = db().contributions.filter((c) => c.goalId === goal.id);
  const currentAmount = contributions.reduce((s, c) => s + c.amount, 0);
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate,
    currentAmount,
    remainingAmount: Math.max(goal.targetAmount - currentAmount, 0),
    progress: Math.min(pct(currentAmount, goal.targetAmount), 100),
    completed: currentAmount >= goal.targetAmount,
  };
}

function budgetView(b) {
  const spent = spentIn(b.userId, b.categoryId, b.period);
  return {
    id: b.id,
    categoryId: b.categoryId,
    categoryName: category(b.categoryId)?.name,
    period: b.period,
    limitAmount: b.limitAmount,
    spent,
    remaining: b.limitAmount - spent,
    usagePercent: pct(spent, b.limitAmount),
    exceeded: spent > b.limitAmount,
  };
}

function expenseBreakdown(userId, predicate) {
  const byCat = new Map();
  for (const t of userTransactions(userId)) {
    if (t.type !== "EXPENSE" || !predicate(t)) continue;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + t.amount);
  }
  const total = [...byCat.values()].reduce((s, v) => s + v, 0);
  return [...byCat.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      categoryName: category(categoryId)?.name,
      amount,
      percent: pct(amount, total),
    }))
    .sort((a, b) => b.amount - a.amount);
}

/* ---------- validation (the Java side must do the same checks) ---------- */

function validateTransaction(body) {
  const fields = {};
  if (!["INCOME", "EXPENSE"].includes(body.type)) fields.type = "Choose income or expense.";
  if (!(Number(body.amount) > 0)) fields.amount = "Enter an amount greater than 0.";
  const cat = category(body.categoryId);
  if (!cat) fields.categoryId = "Choose a category.";
  else if (cat.type !== body.type) fields.categoryId = "This category does not match the transaction type.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) fields.date = "Choose a date.";
  else if (body.date > todayIso()) fields.date = "The date cannot be in the future.";
  if (!body.paymentMethod) fields.paymentMethod = "Choose a payment method.";
  if ((body.description || "").length > 120) fields.description = "Keep the note under 120 characters.";
  if (Object.keys(fields).length) throw invalid(fields);
  return {
    type: body.type,
    amount: round2(Number(body.amount)),
    categoryId: Number(body.categoryId),
    date: body.date,
    paymentMethod: body.paymentMethod,
    description: (body.description || "").trim(),
  };
}

function validateGoal(body) {
  const fields = {};
  if (!body.name?.trim()) fields.name = "Give the goal a name.";
  if (!(Number(body.targetAmount) > 0)) fields.targetAmount = "Enter a target greater than 0.";
  if (!body.targetDate) fields.targetDate = "Choose a target date.";
  else if (body.targetDate <= todayIso()) fields.targetDate = "The target date must be in the future.";
  if (Object.keys(fields).length) throw invalid(fields);
  return { name: body.name.trim(), targetAmount: round2(Number(body.targetAmount)), targetDate: body.targetDate };
}

/* ---------- routes ---------- */

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

// --- Auth (FinanceApp) ---

route("POST", /^\/auth\/login$/, ({ body }) => {
  const email = (body.email || "").toLowerCase().trim();
  const user = db().users.find((u) => u.email.toLowerCase() === email);
  if (!user || db().passwords[user.email] !== body.password) {
    throw new ApiError(401, "Incorrect email or password.");
  }
  if (user.status === "SUSPENDED") throw new ApiError(403, "This account has been suspended.");
  return { token: `mock-token-${user.id}`, user: publicUser(user) };
});

route("POST", /^\/auth\/register$/, ({ body }) => {
  const fields = {};
  const email = (body.email || "").toLowerCase().trim();
  if (!body.firstName?.trim()) fields.firstName = "Enter your first name.";
  if (!body.lastName?.trim()) fields.lastName = "Enter your last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Enter a valid email address.";
  else if (db().users.some((u) => u.email.toLowerCase() === email)) fields.email = "This email is already registered.";
  if ((body.password || "").length < 8) fields.password = "Use at least 8 characters.";
  if (Object.keys(fields).length) throw invalid(fields);

  const user = {
    id: newId(),
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email,
    phone: "",
    country: "Kenya",
    currency: "KES",
    language: "en",
    weekStart: "MONDAY",
    compactNumbers: false,
    budgetAlerts: true,
    goalReminders: true,
    role: "USER",
    status: "ACTIVE",
    memberSince: todayIso(),
  };
  db().users.push(user);
  db().passwords[email] = body.password;
  save();
  return { token: `mock-token-${user.id}`, user: publicUser(user) };
});

route("POST", /^\/auth\/logout$/, () => ({ ok: true }));

route("POST", /^\/auth\/reset-password$/, () => ({
  message: "If that email is registered, a reset link has been sent.",
}));

// --- User profile (User) ---

route("GET", /^\/users\/me$/, ({ user }) => publicUser(user));

route("PUT", /^\/users\/me$/, ({ user, body }) => {
  const fields = {};
  if (!body.firstName?.trim()) fields.firstName = "Enter your first name.";
  if (!body.lastName?.trim()) fields.lastName = "Enter your last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) fields.email = "Enter a valid email address.";
  if (Object.keys(fields).length) throw invalid(fields);
  const oldEmail = user.email;
  Object.assign(user, {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email.trim().toLowerCase(),
    phone: (body.phone || "").trim(),
    country: body.country || user.country,
    currency: body.currency || user.currency,
  });
  if (oldEmail !== user.email) {
    db().passwords[user.email] = db().passwords[oldEmail];
    delete db().passwords[oldEmail];
  }
  save();
  return publicUser(user);
});

route("PUT", /^\/users\/me\/preferences$/, ({ user, body }) => {
  Object.assign(user, {
    language: body.language ?? user.language,
    currency: body.currency ?? user.currency,
    weekStart: body.weekStart ?? user.weekStart,
    compactNumbers: body.compactNumbers ?? user.compactNumbers,
    budgetAlerts: body.budgetAlerts ?? user.budgetAlerts,
    goalReminders: body.goalReminders ?? user.goalReminders,
  });
  save();
  return publicUser(user);
});

route("PUT", /^\/users\/me\/password$/, ({ user, body }) => {
  if (db().passwords[user.email] !== body.currentPassword) {
    throw invalid({ currentPassword: "Your current password is incorrect." });
  }
  if ((body.newPassword || "").length < 8) throw invalid({ newPassword: "Use at least 8 characters." });
  db().passwords[user.email] = body.newPassword;
  save();
  return { ok: true };
});

route("DELETE", /^\/users\/me$/, ({ user }) => {
  const d = db();
  const goalIds = d.goals.filter((g) => g.userId === user.id).map((g) => g.id);
  d.transactions = d.transactions.filter((t) => t.userId !== user.id);
  d.budgets = d.budgets.filter((b) => b.userId !== user.id);
  d.contributions = d.contributions.filter((c) => !goalIds.includes(c.goalId));
  d.goals = d.goals.filter((g) => g.userId !== user.id);
  d.users = d.users.filter((u) => u.id !== user.id);
  delete d.passwords[user.email];
  save();
  return { ok: true };
});

// --- Categories ---

route("GET", /^\/categories$/, ({ params }) =>
  db().categories.filter((c) => !params.get("type") || c.type === params.get("type"))
);

// --- Transactions (Transaction, Income, Expense) ---

route("GET", /^\/transactions$/, ({ user, params }) => {
  const type = params.get("type");
  const categoryId = Number(params.get("categoryId")) || null;
  const from = params.get("from");
  const to = params.get("to");
  const q = (params.get("q") || "").toLowerCase();
  const limit = Number(params.get("limit")) || null;

  let list = userTransactions(user.id)
    .filter((t) => !type || t.type === type)
    .filter((t) => !categoryId || t.categoryId === categoryId)
    .filter((t) => !from || t.date >= from)
    .filter((t) => !to || t.date <= to)
    .map(withCategory)
    .filter((t) => !q || t.description.toLowerCase().includes(q) || t.categoryName.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  if (limit) list = list.slice(0, limit);
  return list;
});

route("GET", /^\/transactions\/(\d+)$/, ({ user, match }) => {
  const t = userTransactions(user.id).find((x) => x.id === Number(match[1]));
  if (!t) throw notFound("Transaction");
  return withCategory(t);
});

route("POST", /^\/transactions$/, ({ user, body }) => {
  const t = { id: newId(), userId: user.id, ...validateTransaction(body) };
  db().transactions.push(t);
  save();
  return withCategory(t);
});

route("PUT", /^\/transactions\/(\d+)$/, ({ user, match, body }) => {
  const t = userTransactions(user.id).find((x) => x.id === Number(match[1]));
  if (!t) throw notFound("Transaction");
  Object.assign(t, validateTransaction(body));
  save();
  return withCategory(t);
});

route("DELETE", /^\/transactions\/(\d+)$/, ({ user, match }) => {
  const before = db().transactions.length;
  db().transactions = db().transactions.filter((t) => !(t.userId === user.id && t.id === Number(match[1])));
  if (db().transactions.length === before) throw notFound("Transaction");
  save();
  return { ok: true };
});

// --- Budgets (Budget) ---

route("GET", /^\/budgets$/, ({ user, params }) => {
  const period = params.get("period") || todayIso().slice(0, 7);
  return db()
    .budgets.filter((b) => b.userId === user.id && b.period === period)
    .map(budgetView)
    .sort((a, b) => b.usagePercent - a.usagePercent);
});

route("POST", /^\/budgets$/, ({ user, body }) => {
  const fields = {};
  const cat = category(body.categoryId);
  if (!cat || cat.type !== "EXPENSE") fields.categoryId = "Choose an expense category.";
  if (!(Number(body.limitAmount) > 0)) fields.limitAmount = "Enter a limit greater than 0.";
  if (!/^\d{4}-\d{2}$/.test(body.period || "")) fields.period = "Choose a month.";
  if (
    !fields.categoryId &&
    db().budgets.some((b) => b.userId === user.id && b.categoryId === cat.id && b.period === body.period)
  ) {
    fields.categoryId = "You already have a budget for this category this month.";
  }
  if (Object.keys(fields).length) throw invalid(fields);
  const b = {
    id: newId(),
    userId: user.id,
    categoryId: cat.id,
    limitAmount: round2(Number(body.limitAmount)),
    period: body.period,
  };
  db().budgets.push(b);
  save();
  return budgetView(b);
});

route("PUT", /^\/budgets\/(\d+)$/, ({ user, match, body }) => {
  const b = db().budgets.find((x) => x.userId === user.id && x.id === Number(match[1]));
  if (!b) throw notFound("Budget");
  if (!(Number(body.limitAmount) > 0)) throw invalid({ limitAmount: "Enter a limit greater than 0." });
  b.limitAmount = round2(Number(body.limitAmount));
  save();
  return budgetView(b);
});

route("DELETE", /^\/budgets\/(\d+)$/, ({ user, match }) => {
  db().budgets = db().budgets.filter((b) => !(b.userId === user.id && b.id === Number(match[1])));
  save();
  return { ok: true };
});

// --- Savings goals (SavingsGoal, SavingsContribution) ---

route("GET", /^\/goals$/, ({ user }) =>
  db()
    .goals.filter((g) => g.userId === user.id)
    .map(goalView)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
);

route("POST", /^\/goals$/, ({ user, body }) => {
  const g = { id: newId(), userId: user.id, createdAt: todayIso(), ...validateGoal(body) };
  db().goals.push(g);
  save();
  return goalView(g);
});

route("PUT", /^\/goals\/(\d+)$/, ({ user, match, body }) => {
  const g = db().goals.find((x) => x.userId === user.id && x.id === Number(match[1]));
  if (!g) throw notFound("Savings goal");
  Object.assign(g, validateGoal(body));
  save();
  return goalView(g);
});

route("DELETE", /^\/goals\/(\d+)$/, ({ user, match }) => {
  const goalId = Number(match[1]);
  db().goals = db().goals.filter((g) => !(g.userId === user.id && g.id === goalId));
  db().contributions = db().contributions.filter((c) => c.goalId !== goalId);
  save();
  return { ok: true };
});

route("POST", /^\/goals\/(\d+)\/contributions$/, ({ user, match, body }) => {
  const g = db().goals.find((x) => x.userId === user.id && x.id === Number(match[1]));
  if (!g) throw notFound("Savings goal");
  if (!(Number(body.amount) > 0)) throw invalid({ amount: "Enter an amount greater than 0." });
  const c = {
    id: newId(),
    goalId: g.id,
    amount: round2(Number(body.amount)),
    date: todayIso(),
    memo: (body.memo || "Manual contribution").trim(),
  };
  db().contributions.push(c);
  save();
  return goalView(g);
});

route("GET", /^\/contributions$/, ({ user, params }) => {
  const limit = Number(params.get("limit")) || 5;
  const goals = new Map(db().goals.filter((g) => g.userId === user.id).map((g) => [g.id, g]));
  return db()
    .contributions.filter((c) => goals.has(c.goalId))
    .map((c) => ({ ...c, goalName: goals.get(c.goalId).name }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, limit);
});

// --- Dashboard (FinancialSummary) ---

route("GET", /^\/dashboard$/, ({ user, params }) => {
  const period = params.get("period") || todayIso().slice(0, 7);
  const now = totalsFor(user.id, period);
  const prev = totalsFor(user.id, shiftPeriod(period, -1));

  const all = userTransactions(user.id);
  const balance = all.reduce((s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount), 0);
  const balanceLastMonth = all
    .filter((t) => t.date < `${period}-01`)
    .reduce((s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount), 0);

  const goals = db().goals.filter((g) => g.userId === user.id).map(goalView);
  const savings = goals.reduce((s, g) => s + g.currentAmount, 0);
  const goalIds = goals.map((g) => g.id);
  const savingsLastMonth = db()
    .contributions.filter((c) => goalIds.includes(c.goalId) && c.date < `${period}-01`)
    .reduce((s, c) => s + c.amount, 0);

  // Week 1 = days 1-7, Week 2 = 8-14, Week 3 = 15-21, Week 4 = 22 to month end
  const weeks = [1, 2, 3, 4].map((w) => ({ label: `Week ${w}`, income: 0, expenses: 0 }));
  for (const t of all) {
    if (!t.date.startsWith(period)) continue;
    const w = Math.min(Math.floor((Number(t.date.slice(8, 10)) - 1) / 7), 3);
    if (t.type === "INCOME") weeks[w].income += t.amount;
    else weeks[w].expenses += t.amount;
  }

  return {
    period,
    totalIncome: now.income,
    totalExpenses: now.expenses,
    balance,
    savings,
    changes: {
      income: change(now.income, prev.income),
      expenses: change(now.expenses, prev.expenses),
      balance: change(balance, balanceLastMonth),
      savings: change(savings, savingsLastMonth),
    },
    weekly: weeks,
    expenseBreakdown: expenseBreakdown(user.id, (t) => t.date.startsWith(period)),
    budgets: db()
      .budgets.filter((b) => b.userId === user.id && b.period === period)
      .map(budgetView)
      .sort((a, b) => b.usagePercent - a.usagePercent),
    recentTransactions: all
      .map(withCategory)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 5),
    goals: goals.slice(0, 3),
  };
});

// --- Reports (ReportGenerator, MonthlySummaryReport, ExpenseBreakdownReport) ---

function reportSummary(userId, months) {
  const current = todayIso().slice(0, 7);
  const periods = [];
  for (let i = months - 1; i >= 0; i--) periods.push(shiftPeriod(current, -i));
  const first = periods[0];

  const monthly = periods.map((p) => ({ period: p, ...totalsFor(userId, p) }));
  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);

  // compare with the same number of months before the range
  const prevPeriods = periods.map((p) => shiftPeriod(p, -months));
  const prevIncome = prevPeriods.reduce((s, p) => s + totalsFor(userId, p).income, 0);
  const prevExpenses = prevPeriods.reduce((s, p) => s + totalsFor(userId, p).expenses, 0);

  const budgetTotal = db()
    .budgets.filter((b) => b.userId === userId && b.period === current)
    .reduce((s, b) => s + b.limitAmount, 0);
  const avgMonthlySpend = round2(totalExpenses / months);

  return {
    months,
    from: first,
    to: current,
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    savingsRate: pct(totalIncome - totalExpenses, totalIncome),
    avgMonthlySpend,
    monthlyBudget: budgetTotal,
    changes: { income: change(totalIncome, prevIncome), expenses: change(totalExpenses, prevExpenses) },
    monthly,
    categoryBreakdown: expenseBreakdown(userId, (t) => t.date.slice(0, 7) >= first),
    currentMonthBreakdown: expenseBreakdown(userId, (t) => t.date.startsWith(current)),
  };
}

route("GET", /^\/reports\/summary$/, ({ user, params }) => reportSummary(user.id, Number(params.get("months")) || 6));

route("GET", /^\/reports\/export$/, ({ user, params }) => {
  const months = Number(params.get("months")) || 6;
  const r = reportSummary(user.id, months);
  const lines = [
    `PesaPlan report,${r.from} to ${r.to}`,
    "",
    "Month,Income,Expenses,Net",
    ...r.monthly.map((m) => `${m.period},${m.income},${m.expenses},${m.income - m.expenses}`),
    `Total,${r.totalIncome},${r.totalExpenses},${r.netSavings}`,
    "",
    "Category,Amount,Percent",
    ...r.categoryBreakdown.map((c) => `"${c.categoryName}",${c.amount},${c.percent}`),
  ];
  return {
    blob: new Blob([lines.join("\n")], { type: "text/csv" }),
    filename: `pesaplan-report-${r.from}-to-${r.to}.csv`,
  };
});

// --- Notifications (BudgetMonitor + InAppNotifier) ---

route("GET", /^\/notifications$/, ({ user }) => {
  if (user.budgetAlerts === false) return [];
  const period = todayIso().slice(0, 7);
  return db()
    .budgets.filter((b) => b.userId === user.id && b.period === period)
    .map(budgetView)
    .filter((b) => b.usagePercent >= 80)
    .sort((a, b) => b.usagePercent - a.usagePercent)
    .map((b) => ({
      id: `budget-${b.id}`,
      level: b.usagePercent >= 100 ? "danger" : "warning",
      title: b.usagePercent >= 100 ? `${b.categoryName} budget exceeded` : `${b.categoryName} budget almost used`,
      message: `You have used ${Math.round(b.usagePercent)}% of your ${b.categoryName} budget this month.`,
    }));
});

/* ---------- dispatcher ---------- */

const PUBLIC = /^\/auth\//;

export async function mockRequest(method, fullPath, body = {}, token) {
  const [path, search = ""] = fullPath.split("?");
  const params = new URLSearchParams(search);
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = r.pattern.exec(path);
    if (!match) continue;
    const user = PUBLIC.test(path) ? null : requireUser(token);
    // return a deep copy so pages cannot change the "database" by accident
    const result = r.handler({ user, body: body || {}, params, match });
    return result instanceof Object && result.blob ? result : JSON.parse(JSON.stringify(result));
  }
  throw new ApiError(404, `No mock route for ${method} ${path}`);
}
