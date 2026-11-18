/**
 * dashboard.js - View Dashboard use case (Epic 5).
 * One API call (GET /dashboard) returns every number on the screen,
 * calculated by FinancialSummary on the backend.
 */
import { initLayout } from "../components/layout.js";
import { dashboardApi } from "../api/reports.js";
import { statCard, progressBar, emptyState, toastError } from "../components/ui.js";
import { barChart, donutChart } from "../components/charts.js";
import { $, esc } from "../utils/dom.js";
import { money, formatDate, monthYear, currentPeriod, periodLabel } from "../utils/format.js";
import { categoryColor, categoryEmoji, goalEmoji, usageColor } from "../utils/categories.js";

const user = await initLayout("dashboard");
if (user) {
  try {
    render(await dashboardApi.summary(currentPeriod()));
  } catch (err) {
    toastError(err);
  }
}

function render(d) {
  $("#stats").innerHTML = [
    statCard({ label: "Total Income", value: money(d.totalIncome), iconName: "arrowUpRight", delta: { value: d.changes.income } }),
    statCard({
      label: "Total Expenses",
      value: money(d.totalExpenses),
      iconName: "arrowDownLeft",
      tone: "danger",
      delta: { value: d.changes.expenses, goodWhenUp: false },
    }),
    statCard({ label: "Current Balance", value: money(d.balance), iconName: "wallet", tone: "primary", delta: { value: d.changes.balance } }),
    statCard({ label: "Savings", value: money(d.savings), iconName: "savings", tone: "purple", delta: { value: d.changes.savings } }),
  ].join("");

  $("#period-badge").textContent = periodLabel(d.period);

  barChart($("#weekly-chart"), {
    labels: d.weekly.map((w) => w.label),
    series: [
      { name: "Income", color: "var(--income)", values: d.weekly.map((w) => w.income) },
      { name: "Expenses", color: "var(--expense)", values: d.weekly.map((w) => w.expenses) },
    ],
    height: 220,
  });

  renderBreakdown(d);
  renderBudgets(d.budgets);
  renderRecent(d.recentTransactions);
  renderGoals(d.goals);
}

function renderBreakdown(d) {
  const items = d.expenseBreakdown.map((c, i) => ({
    label: c.categoryName,
    value: c.amount,
    percent: c.percent,
    color: categoryColor(c.categoryName, i),
  }));

  if (!items.length) {
    $("#expense-donut").innerHTML = "";
    $("#expense-list").innerHTML = emptyState("No expenses recorded this month.", "🧾");
    return;
  }

  donutChart($("#expense-donut"), {
    items,
    centerValue: money(d.totalExpenses, { compact: true }),
    centerLabel: "Total Exp.",
    size: 150,
    stroke: 24,
  });

  $("#expense-list").innerHTML = items
    .slice(0, 6)
    .map(
      (i) => `<div class="row">
        <span class="label"><span class="swatch" style="background:${i.color}"></span>${esc(i.label)}</span>
        <span class="pct">${Math.round(i.percent)}%</span>
        <span class="amount num">${money(i.value, { compact: true })}</span>
      </div>`
    )
    .join("");
}

function renderBudgets(budgets) {
  const box = $("#budget-list");
  if (!budgets.length) {
    box.innerHTML = `${emptyState("No budgets for this month yet.", "🎯")}<a class="btn btn-block" href="budgets.html">Create a budget</a>`;
    return;
  }
  box.innerHTML = budgets
    .slice(0, 4)
    .map((b) => {
      const color = usageColor(b.usagePercent);
      return `<div class="mini-budget">
        <div class="top">
          <div>
            <div class="name">${categoryEmoji(b.categoryName)} ${esc(b.categoryName)}</div>
            <div class="small muted num">${money(b.spent)} / ${money(b.limitAmount)}</div>
          </div>
          <strong class="small" style="color:${color}">${Math.round(b.usagePercent)}%</strong>
        </div>
        ${progressBar(b.usagePercent, color)}
      </div>`;
    })
    .join("");
}

function renderRecent(list) {
  const body = $("#recent-body");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="5">${emptyState("No transactions yet. Add your first one.", "🧾")}</td></tr>`;
    return;
  }
  body.innerHTML = list
    .map((t) => {
      const income = t.type === "INCOME";
      return `<tr>
        <td class="muted">${formatDate(t.date)}</td>
        <td><div class="desc"><span class="emoji-tile round">${categoryEmoji(t.categoryName)}</span>${esc(t.description || t.categoryName)}</div></td>
        <td>${esc(t.categoryName)}</td>
        <td class="${income ? "text-success" : "text-danger"}">${income ? "Income" : "Expense"}</td>
        <td class="right num ${income ? "text-success" : "text-danger"}">${money(t.amount, { sign: true, type: t.type })}</td>
      </tr>`;
    })
    .join("");
}

function renderGoals(goals) {
  const box = $("#goal-list");
  if (!goals.length) {
    box.innerHTML = `${emptyState("No savings goals yet.", "🌱")}<a class="btn btn-block" href="savings.html">Create a goal</a>`;
    return;
  }
  box.innerHTML = goals
    .map(
      (g) => `<div class="goal-line">
        <div class="top">
          <span class="emoji-tile round">${goalEmoji(g.name)}</span>
          <div class="grow">
            <div class="title">${esc(g.name)}</div>
            <div class="small muted num">${money(g.currentAmount)} / ${money(g.targetAmount)}</div>
          </div>
          <div class="small muted">Due ${monthYear(g.targetDate)}</div>
        </div>
        <div class="bar-with-pct">${progressBar(g.progress, "var(--success)")}<strong class="small">${Math.round(g.progress)}%</strong></div>
      </div>`
    )
    .join("");
}
