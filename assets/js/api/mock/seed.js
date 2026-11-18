/**
 * seed.js - builds believable demo data for mock mode.
 * Dates are generated relative to today, so the dashboard always has
 * a current month to show. The random generator is seeded, so the
 * numbers are the same every time you reset.
 */

function seededRandom(seed) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const DEMO_EMAIL = "ann.micheni@email.com";
export const DEMO_PASSWORD = "password123";

export function createSeed() {
  const rand = seededRandom(42);
  const between = (min, max) => Math.round((min + rand() * (max - min)) / 50) * 50;
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextId = 1000;
  const id = () => nextId++;

  const categories = [
    { id: 1, name: "Salary", type: "INCOME" },
    { id: 2, name: "Freelance", type: "INCOME" },
    { id: 3, name: "Other income", type: "INCOME" },
    { id: 10, name: "Housing", type: "EXPENSE" },
    { id: 11, name: "Food & groceries", type: "EXPENSE" },
    { id: 12, name: "Transport", type: "EXPENSE" },
    { id: 13, name: "Utilities", type: "EXPENSE" },
    { id: 14, name: "Entertainment", type: "EXPENSE" },
    { id: 15, name: "Lifestyle", type: "EXPENSE" },
    { id: 16, name: "Other", type: "EXPENSE" },
  ];

  const memberSince = new Date(today.getFullYear() - 1, 2, 14);
  const user = {
    id: 1,
    firstName: "Ann",
    lastName: "Micheni",
    email: DEMO_EMAIL,
    phone: "+254 712 345 678",
    country: "Kenya",
    currency: "KES",
    language: "en",
    weekStart: "MONDAY",
    compactNumbers: false,
    budgetAlerts: true,
    goalReminders: true,
    role: "USER",
    status: "ACTIVE",
    memberSince: iso(memberSince),
  };

  const transactions = [];
  const methods = ["M-PESA", "M-PESA", "M-PESA", "Cash", "Debit card", "Bank transfer"];
  const foodNotes = ["Groceries", "Naivas", "Carrefour", "Market veggies", "Lunch", "Java coffee"];
  const transportNotes = ["Uber", "Matatu fare", "Bolt", "Fuel", "Parking"];
  const funNotes = ["Cinema", "Showmax", "Concert tickets", "Bowling"];
  const lifeNotes = ["New shoes", "Salon", "Gym membership", "Clothes"];

  const add = (userId, type, categoryId, amount, date, description, paymentMethod = pick(methods)) => {
    if (date > today) return;
    transactions.push({ id: id(), userId, type, categoryId, amount, date: iso(date), description, paymentMethod });
  };

  for (let back = 5; back >= 0; back--) {
    const y = today.getFullYear();
    const m = today.getMonth() - back;
    const day = (d) => new Date(y, m, d);

    add(1, "INCOME", 1, 80000, day(25), "Salary", "Bank transfer");
    add(1, "INCOME", 2, between(6000, 30000), day(9), "Freelance project", "M-PESA");
    if (back % 2 === 0) add(1, "INCOME", 3, between(1500, 6000), day(17), "Chama payout", "M-PESA");

    add(1, "EXPENSE", 10, 15000, day(1), "Rent", "Bank transfer");
    for (let i = 0; i < 6; i++) add(1, "EXPENSE", 11, between(800, 3200), day(2 + i * 4), pick(foodNotes));
    for (let i = 0; i < 7; i++) add(1, "EXPENSE", 12, between(250, 1300), day(3 + i * 3), pick(transportNotes));
    add(1, "EXPENSE", 13, between(1800, 3500), day(5), "KPLC tokens");
    add(1, "EXPENSE", 13, 2500, day(6), "Home internet");
    for (let i = 0; i < 2; i++) add(1, "EXPENSE", 14, between(700, 2200), day(8 + i * 9), pick(funNotes));
    add(1, "EXPENSE", 15, between(1500, 4500), day(19), pick(lifeNotes));
    add(1, "EXPENSE", 16, between(400, 1800), day(23), "Miscellaneous");
  }

  const period = iso(today).slice(0, 7);
  const budgets = [
    { categoryId: 11, limitAmount: 15000 },
    { categoryId: 12, limitAmount: 8000 },
    { categoryId: 10, limitAmount: 15000 },
    { categoryId: 14, limitAmount: 5000 },
    { categoryId: 13, limitAmount: 7000 },
  ].map((b) => ({ id: id(), userId: 1, period, ...b }));

  const goals = [
    { name: "Emergency Fund", targetAmount: 100000, monthsAhead: 2, monthly: 10000 },
    { name: "New Laptop", targetAmount: 120000, monthsAhead: 9, monthly: 5800 },
    { name: "Holiday in Zanzibar", targetAmount: 80000, monthsAhead: 4, monthly: 8000 },
  ].map((g) => ({
    id: id(),
    userId: 1,
    name: g.name,
    targetAmount: g.targetAmount,
    targetDate: iso(new Date(today.getFullYear(), today.getMonth() + g.monthsAhead, 28)),
    createdAt: iso(new Date(today.getFullYear(), today.getMonth() - 6, 1)),
    monthly: g.monthly,
  }));

  const contributions = [];
  goals.forEach((goal, gi) => {
    for (let back = 5; back >= 0; back--) {
      const date = new Date(today.getFullYear(), today.getMonth() - back, 1 + gi * 6);
      if (date > today) continue;
      contributions.push({
        id: id(),
        goalId: goal.id,
        amount: goal.monthly,
        date: iso(date),
        memo: gi === 1 ? "Manual contribution" : "Automatic deposit",
      });
    }
    delete goal.monthly;
  });

  return {
    nextId,
    users: [user],
    passwords: { [DEMO_EMAIL]: DEMO_PASSWORD },
    categories,
    transactions,
    budgets,
    goals,
    contributions,
  };
}
