/**
 * reports.js - Generate Report and Export Report (Epic 6).
 * GET /reports/summary?months=6 returns the MonthlySummaryReport and
 * ExpenseBreakdownReport results together.
 */
import { initLayout } from "../components/layout.js";
import { reportApi } from "../api/reports.js";
import { statCard, ring, progressBar, emptyState, toast, toastError } from "../components/ui.js";
import { barChart, donutChart } from "../components/charts.js";
import { $, esc, withBusy } from "../utils/dom.js";
import { money, periodShort, periodLabel, currentPeriod } from "../utils/format.js";
import { categoryColor, categoryEmoji } from "../utils/categories.js";

const user = await initLayout("reports");
const monthsSelect = $("#months");

if (user) {
  monthsSelect.addEventListener("change", load);
  $("#export").addEventListener("click", exportReport);
  load();
}

async function load() {
  try {
    render(await reportApi.summary(Number(monthsSelect.value)));
  } catch (err) {
    toastError(err);
  }
}

function render(r) {
  const budgetGap = r.monthlyBudget ? r.monthlyBudget - r.avgMonthlySpend : null;
  const label = `vs previous ${r.months} months`;

  $("#stats").innerHTML = [
    statCard({ label: "Total income", value: money(r.totalIncome), iconName: "arrowUpRight", meta: `Last ${r.months} months`, delta: { value: r.changes.income }, deltaSuffix: label }),
    statCard({
      label: "Total expenses",
      value: money(r.totalExpenses),
      iconName: "arrowDownLeft",
      tone: "danger",
      meta: `Last ${r.months} months`,
      delta: { value: r.changes.expenses, goodWhenUp: false },
      deltaSuffix: label,
    }),
    statCard({
      label: "Net savings",
      value: money(r.netSavings),
      iconName: "target",
      tone: "primary",
      meta: `${r.savingsRate.toFixed(1)}% savings rate`,
    }),
    statCard({
      label: "Avg. monthly spend",
      value: money(r.avgMonthlySpend),
      iconName: "gauge",
      tone: "purple",
      meta:
        budgetGap === null
          ? "Set budgets to compare"
          : budgetGap >= 0
            ? `${money(budgetGap)} under budget`
            : `${money(-budgetGap)} over budget`,
    }),
  ].join("");

  barChart($("#cashflow-chart"), {
    labels: r.monthly.map((m) => periodShort(m.period)),
    series: [
      { name: "Income", color: "var(--income)", values: r.monthly.map((m) => m.income) },
      { name: "Expenses", color: "var(--expense)", values: r.monthly.map((m) => m.expenses) },
    ],
    height: 280,
  });

  renderBreakdown(r.currentMonthBreakdown);
  renderTop(r);
  renderHealth(r);
}

function renderBreakdown(list) {
  $("#breakdown-period").textContent = periodLabel(currentPeriod());
  const items = list.map((c, i) => ({ label: c.categoryName, value: c.amount, percent: c.percent, color: categoryColor(c.categoryName, i) }));
  const total = items.reduce((s, i) => s + i.value, 0);

  if (!items.length) {
    $("#breakdown-donut").innerHTML = "";
    $("#breakdown-list").innerHTML = emptyState("No spending recorded this month.", "🧾");
    return;
  }

  donutChart($("#breakdown-donut"), { items, centerValue: money(total, { compact: true }), centerLabel: "Total spent", size: 180, stroke: 28 });
  $("#breakdown-list").innerHTML = items
    .map(
      (i) => `<div class="row">
        <span class="label"><span class="swatch" style="background:${i.color}"></span><strong>${esc(i.label)}</strong></span>
        <span class="pct">${Math.round(i.percent)}%</span>
        <span class="amount num">${money(i.value)}</span>
      </div>`
    )
    .join("");
}

function renderTop(r) {
  $("#top-period").textContent = `Where your money went in the last ${r.months} months`;
  const top = r.categoryBreakdown.slice(0, 5);
  $("#top-list").innerHTML = top.length
    ? top
        .map(
          (c, i) => `<div class="list-row">
            <span class="rank">${String(i + 1).padStart(2, "0")}</span>
            <span class="emoji-tile">${categoryEmoji(c.categoryName)}</span>
            <div class="grow">
              <div class="title">${esc(c.categoryName)}</div>
              <div class="sub">${Math.round(c.percent)}% of total spending</div>
              <div style="margin-top:6px;max-width:260px">${progressBar(c.percent, categoryColor(c.categoryName, i), true)}</div>
            </div>
            <strong class="num">${money(c.amount)}</strong>
          </div>`
        )
        .join("")
    : emptyState("No spending in this period.", "🧾");
}

/**
 * The design's "financial health" score is shown here as the savings rate,
 * which is calculated from the user's own data and is easy to explain.
 */
function renderHealth(r) {
  const rate = Math.max(0, r.savingsRate);
  let tone = { label: "Needs attention", color: "var(--danger)", line: "You're spending most of what you earn. Try setting budgets for your top categories." };
  if (rate >= 20) tone = { label: "Excellent", color: "var(--success)", line: "You're saving at least a fifth of your income. Keep it up!" };
  else if (rate >= 10) tone = { label: "Good", color: "var(--warning)", line: "A solid start. Aim for 20% to build your safety net faster." };

  $("#health").innerHTML = `
    <div>
      <span class="badge">Financial health</span>
      <h2>${rate >= 20 ? `You're doing well, ${esc(user.firstName)}` : `Keep going, ${esc(user.firstName)}`}</h2>
      <p class="small muted">You saved <strong>${r.savingsRate.toFixed(1)}%</strong> of your income in the last ${r.months} months. ${tone.line}</p>
    </div>
    ${ring(rate, { size: 120, stroke: 10, color: tone.color, value: `${Math.round(r.savingsRate)}%`, sub: tone.label })}`;
}

async function exportReport() {
  try {
    await withBusy($("#export"), "Exporting...", () => reportApi.export(Number(monthsSelect.value), "csv"));
    toast("Report downloaded");
  } catch (err) {
    toastError(err);
  }
}
