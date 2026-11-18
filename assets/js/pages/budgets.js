/**
 * budgets.js - Manage Budgets (Epic 3): create, edit limit, delete,
 * monthly utilisation and overspending.
 * `spent`, `usagePercent` and `exceeded` come from the backend (Budget class).
 */
import { initLayout } from "../components/layout.js";
import { budgetApi } from "../api/budgets.js";
import { categoryApi } from "../api/transactions.js";
import { icon } from "../components/icons.js";
import { statCard, progressBar, ring, emptyState, openModal, confirmDialog, toast, toastError } from "../components/ui.js";
import { $, esc, formData } from "../utils/dom.js";
import { money, currentPeriod, periodLabel, lastPeriods, currencySymbol } from "../utils/format.js";
import { categoryEmoji, usageColor } from "../utils/categories.js";

const user = await initLayout("budgets");
const periodSelect = $("#period");
let budgets = [];
let categories = [];

if (user) init();

async function init() {
  // previous 5 months, this month and next month (plan ahead)
  const periods = [...lastPeriods(6), nextPeriod(currentPeriod())].reverse();
  periodSelect.innerHTML = periods
    .map((p) => `<option value="${p}"${p === currentPeriod() ? " selected" : ""}>${periodLabel(p)}</option>`)
    .join("");

  categories = await categoryApi.list("EXPENSE");
  periodSelect.addEventListener("change", load);
  $("#create-budget").addEventListener("click", createBudget);
  $("#edit-limits").addEventListener("click", editAllLimits);
  $("#budget-rows").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit]");
    if (btn) editBudget(budgets.find((b) => String(b.id) === btn.dataset.edit));
  });
  load();
}

function nextPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function load() {
  try {
    budgets = await budgetApi.list(periodSelect.value);
    render();
  } catch (err) {
    toastError(err);
  }
}

function render() {
  const period = periodSelect.value;
  const total = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const spent = budgets.reduce((s, b) => s + b.spent, 0);
  const remaining = total - spent;
  const usage = total > 0 ? (spent / total) * 100 : 0;

  $("#stats").innerHTML = [
    statCard({
      label: "Total budget",
      value: money(total),
      iconName: "budgets",
      meta: `Across ${budgets.length} categor${budgets.length === 1 ? "y" : "ies"}`,
    }),
    statCard({ label: "Total spent", value: money(spent), iconName: "arrowUpRight", tone: "danger", meta: `${Math.round(usage)}% of your budget` }),
    statCard({
      label: remaining >= 0 ? "Remaining" : "Over budget",
      value: money(Math.abs(remaining)),
      iconName: "target",
      tone: remaining >= 0 ? "primary" : "danger",
      meta: remaining >= 0 ? `${Math.max(0, 100 - Math.round(usage))}% left to spend` : "You have spent more than planned",
    }),
  ].join("");

  $("#hero-period").textContent = periodLabel(period);
  $("#hero").innerHTML = budgets.length
    ? `${ring(usage, { size: 120, value: `${Math.round(usage)}%`, sub: "used", color: usageColor(usage) })}
       <div class="grow">
         <div class="small muted">You've spent</div>
         <div class="big">${money(spent)} <span class="small muted">of ${money(total)}</span></div>
         ${progressBar(usage, usageColor(usage))}
         <div class="small muted" style="margin-top:8px">${
           remaining >= 0 ? `${money(remaining)} available for the rest of the month` : `${money(-remaining)} over your total budget`
         }</div>
       </div>`
    : emptyState(`No budgets for ${periodLabel(period)} yet. Create one to start tracking.`, "🎯");

  $("#insight").innerHTML = insight(period);
  renderRows();
}

/** A plain-language tip based on the budget closest to its limit. */
function insight(period) {
  if (!budgets.length) return "Set a budget for your biggest spending category first. Food and transport are good places to start.";
  const top = [...budgets].sort((a, b) => b.usagePercent - a.usagePercent)[0];
  const name = esc(top.categoryName);

  if (period !== currentPeriod()) {
    const over = budgets.filter((b) => b.exceeded).length;
    return over
      ? `You went over budget in <strong>${over}</strong> categor${over === 1 ? "y" : "ies"} in ${periodLabel(period)}. ${name} was the furthest over.`
      : `You stayed within every budget in ${periodLabel(period)}. Well done!`;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;

  if (top.exceeded) {
    return `Your <strong>${name}</strong> budget is <strong>${money(top.spent - top.limitAmount)}</strong> over its limit. Consider raising the limit or cutting back for the rest of the month.`;
  }
  if (top.remaining <= 0) {
    return `You've used all of your <strong>${name}</strong> budget with ${daysLeft} days left. Any more ${name} spending this month will go over the limit.`;
  }
  if (top.usagePercent >= 75) {
    const perDay = top.remaining / daysLeft;
    return `<strong>${name}</strong> is at <strong>${Math.round(top.usagePercent)}%</strong> with ${daysLeft} days left. Keep it under <strong>${money(perDay)}</strong> a day to stay on track.`;
  }
  return `All budgets are on track. Your highest is <strong>${name}</strong> at <strong>${Math.round(top.usagePercent)}%</strong> with ${daysLeft} days left.`;
}

function renderRows() {
  const box = $("#budget-rows");
  if (!budgets.length) {
    box.innerHTML = emptyState("No category budgets for this month.", "🗂️");
    return;
  }
  box.innerHTML = budgets
    .map((b) => {
      const color = usageColor(b.usagePercent);
      return `<div class="budget-row">
        <span class="emoji-tile">${categoryEmoji(b.categoryName)}</span>
        <div>
          <div class="top">
            <strong class="small">${esc(b.categoryName)}</strong>
            <span class="small muted num">${money(b.spent)} of ${money(b.limitAmount)}</span>
          </div>
          ${progressBar(b.usagePercent, color)}
        </div>
        <span class="pct" style="color:${color}">${Math.round(b.usagePercent)}%</span>
        <button class="icon-btn" data-edit="${b.id}" aria-label="Edit ${esc(b.categoryName)} budget">${icon("edit")}</button>
      </div>`;
    })
    .join("");
}

/* ---------- Create / edit ---------- */

async function createBudget() {
  const period = periodSelect.value;
  const used = new Set(budgets.map((b) => b.categoryId));
  const free = categories.filter((c) => !used.has(c.id));
  if (!free.length) {
    toast(`Every category already has a budget for ${periodLabel(period)}.`, "error");
    return;
  }

  const created = await openModal({
    title: "Create budget",
    submitLabel: "Create budget",
    body: `
      <div class="field">
        <label for="m-cat">Category</label>
        <select class="select" id="m-cat" name="categoryId">
          ${free.map((c) => `<option value="${c.id}">${categoryEmoji(c.name)} ${esc(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="m-limit">Monthly limit</label>
        <div class="input-group"><span class="addon">${currencySymbol()}</span>
          <input class="input" id="m-limit" name="limitAmount" type="number" min="1" step="1" placeholder="15000"></div>
      </div>
      <div class="field">
        <label for="m-period">Month</label>
        <input class="input" id="m-period" name="period" type="month" value="${period}">
      </div>`,
    onSubmit: (form) => {
      const data = formData(form);
      return budgetApi.create({ categoryId: Number(data.categoryId), limitAmount: Number(data.limitAmount), period: data.period });
    },
  });
  if (created) {
    toast("Budget created");
    load();
  }
}

async function editBudget(budget) {
  if (!budget) return;
  const pending = openModal({
    title: `${budget.categoryName} budget`,
    submitLabel: "Save limit",
    body: `
      <div class="field">
        <label for="m-limit">Monthly limit</label>
        <div class="input-group"><span class="addon">${currencySymbol()}</span>
          <input class="input" id="m-limit" name="limitAmount" type="number" min="1" step="1" value="${budget.limitAmount}"></div>
        <span class="hint">Spent so far: ${money(budget.spent)}</span>
      </div>
      <button type="button" class="btn btn-danger-outline" id="m-delete">${icon("trash")} Delete this budget</button>`,
    onSubmit: (form) => budgetApi.update(budget.id, { limitAmount: Number(formData(form).limitAmount) }),
  });

  // The modal is already in the page, so its delete button can be wired now.
  $("#m-delete").addEventListener("click", async (e) => {
    e.target.closest("dialog").querySelector("[data-close]").click();
    const ok = await confirmDialog({
      title: "Delete budget?",
      message: `Your ${budget.categoryName} transactions stay. Only the limit is removed.`,
    });
    if (!ok) return;
    try {
      await budgetApi.remove(budget.id);
      toast("Budget deleted");
      load();
    } catch (err) {
      toastError(err);
    }
  });

  if (await pending) {
    toast("Budget updated");
    load();
  }
}

async function editAllLimits() {
  if (!budgets.length) return createBudget();
  const saved = await openModal({
    title: `Edit limits for ${periodLabel(periodSelect.value)}`,
    submitLabel: "Save all",
    body: budgets
      .map(
        (b) => `<div class="field">
          <label for="lim-${b.id}">${categoryEmoji(b.categoryName)} ${esc(b.categoryName)}</label>
          <div class="input-group"><span class="addon">${currencySymbol()}</span>
            <input class="input" id="lim-${b.id}" name="limit-${b.id}" type="number" min="1" step="1" value="${b.limitAmount}"></div>
        </div>`
      )
      .join(""),
    onSubmit: async (form) => {
      const data = formData(form);
      const changed = budgets.filter((b) => Number(data[`limit-${b.id}`]) !== b.limitAmount);
      await Promise.all(changed.map((b) => budgetApi.update(b.id, { limitAmount: Number(data[`limit-${b.id}`]) })));
    },
  });
  if (saved) {
    toast("Limits updated");
    load();
  }
}
