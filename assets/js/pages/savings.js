/**
 * savings.js - Manage Savings Goals (Epic 4): create, edit, delete,
 * add money (Add Contribution, which includes Recalculate Progress).
 * currentAmount, progress and remainingAmount come from SavingsGoal on the backend.
 */
import { initLayout } from "../components/layout.js";
import { savingsApi } from "../api/savings.js";
import { icon } from "../components/icons.js";
import { statCard, progressBar, emptyState, openModal, confirmDialog, toast, toastError } from "../components/ui.js";
import { $, esc, formData } from "../utils/dom.js";
import { money, formatDate, monthYear, currentPeriod, lastPeriods, periodShort, currencySymbol, todayIso } from "../utils/format.js";
import { goalEmoji } from "../utils/categories.js";

const user = await initLayout("savings");
let goals = [];
let contributions = [];

const PROGRESS_COLORS = ["var(--success)", "var(--primary)", "var(--purple)", "var(--warning)"];

if (user) {
  $("#new-goal").addEventListener("click", () => goalForm());
  $("#goal-cards").addEventListener("click", onCardClick);
  document.addEventListener("click", () => document.querySelectorAll(".goal-menu .dropdown-panel").forEach((p) => (p.hidden = true)));
  load();
}

async function load() {
  try {
    [goals, contributions] = await Promise.all([savingsApi.list(), savingsApi.recentContributions(100)]);
    render();
  } catch (err) {
    toastError(err);
  }
}

function render() {
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const thisMonth = contributions.filter((c) => c.date.startsWith(currentPeriod())).reduce((s, c) => s + c.amount, 0);
  const completed = goals.filter((g) => g.completed).length;

  $("#stats").innerHTML = [
    statCard({ label: "Total saved", value: money(totalSaved), iconName: "savings", meta: `Across ${goals.length} goal${goals.length === 1 ? "" : "s"}` }),
    statCard({ label: "Contributed this month", value: money(thisMonth), iconName: "arrowUpRight", tone: "primary", meta: "Every deposit counts" }),
    statCard({
      label: "Goals completed",
      value: `${completed} of ${goals.length}`,
      iconName: "star",
      tone: "purple",
      meta: completed ? "You're making great progress" : "Your first win is coming",
    }),
  ].join("");

  renderCards();
  renderStreak();
  renderActivity();
}

function renderCards() {
  const box = $("#goal-cards");
  if (!goals.length) {
    box.innerHTML = `<div class="card">${emptyState("No savings goals yet. Create one to start saving with purpose.", "🌱")}</div>`;
    return;
  }
  box.innerHTML = goals
    .map((g, i) => {
      const color = g.completed ? "var(--success)" : PROGRESS_COLORS[i % PROGRESS_COLORS.length];
      return `<article class="card goal-card">
        <div class="head">
          <span class="emoji-tile">${goalEmoji(g.name)}</span>
          <div class="goal-menu">
            <button class="icon-btn" data-menu="${g.id}" aria-label="Options for ${esc(g.name)}">${icon("more")}</button>
            <div class="dropdown-panel" hidden>
              <button class="dropdown-item" data-edit="${g.id}">${icon("edit")}Edit goal</button>
              <button class="dropdown-item" data-delete="${g.id}">${icon("trash")}Delete goal</button>
            </div>
          </div>
        </div>
        <div class="name">${esc(g.name)}</div>
        <div class="small muted">Due ${monthYear(g.targetDate)}</div>
        <div class="amount">${money(g.currentAmount)} <span>of ${money(g.targetAmount)}</span></div>
        ${progressBar(g.progress, color)}
        <div class="foot">
          <strong style="color:${color}">${Math.round(g.progress)}% complete</strong>
          <span class="muted">${g.completed ? "Goal reached 🎉" : `${money(g.remainingAmount)} to go`}</span>
        </div>
        <button class="btn btn-block" data-add="${g.id}"${g.completed ? " disabled" : ""}>Add money</button>
      </article>`;
    })
    .join("");
}

/** Counts back from this month while each month has at least one contribution. */
function renderStreak() {
  const months = lastPeriods(6);
  const active = new Set(contributions.map((c) => c.date.slice(0, 7)));
  let streak = 0;
  for (const p of [...lastPeriods(24)].reverse()) {
    if (active.has(p)) streak++;
    else if (p !== currentPeriod()) break; // this month may simply not have a deposit yet
  }

  const dots = months
    .map(
      (p) => `<div class="dot"><span class="circle${active.has(p) ? " on" : ""}">${active.has(p) ? icon("check") : ""}</span>${periodShort(p).charAt(0)}</div>`
    )
    .join("");

  $("#streak").innerHTML = streak
    ? `<div class="sprout">🌱</div>
       <span class="badge">${streak} month streak</span>
       <h2>Your consistency is paying off</h2>
       <p class="small muted">You've contributed to your savings ${streak === 1 ? "this month" : `for ${streak} months in a row`}.</p>
       <div class="streak-dots">${dots}</div>`
    : `<div class="sprout">🌱</div>
       <h2>Start a saving streak</h2>
       <p class="small muted">Add money to any goal each month to build the habit.</p>
       <div class="streak-dots">${dots}</div>`;
}

function renderActivity() {
  const box = $("#activity");
  const recent = contributions.slice(0, 5);
  if (!recent.length) {
    box.innerHTML = emptyState("No contributions yet.", "💸");
    return;
  }
  box.innerHTML = recent
    .map(
      (c) => `<div class="list-row">
        <span class="emoji-tile round" style="color:var(--success)">${icon("arrowUpRight")}</span>
        <div class="grow">
          <div class="title">${esc(c.goalName)}</div>
          <div class="sub">${esc(c.memo)}</div>
        </div>
        <span class="small muted" style="width:120px">${formatDate(c.date)}</span>
        <strong class="text-success num" style="width:110px;text-align:right">+${money(c.amount)}</strong>
      </div>`
    )
    .join("");
}

/* ---------- Actions ---------- */

function onCardClick(e) {
  const menuBtn = e.target.closest("[data-menu]");
  if (menuBtn) {
    e.stopPropagation();
    const panel = menuBtn.nextElementSibling;
    const wasHidden = panel.hidden;
    document.querySelectorAll(".goal-menu .dropdown-panel").forEach((p) => (p.hidden = true));
    panel.hidden = !wasHidden;
    return;
  }
  const find = (attr) => goals.find((g) => String(g.id) === e.target.closest(`[${attr}]`)?.getAttribute(attr));
  if (e.target.closest("[data-add]")) addMoney(find("data-add"));
  else if (e.target.closest("[data-edit]")) goalForm(find("data-edit"));
  else if (e.target.closest("[data-delete]")) deleteGoal(find("data-delete"));
}

async function addMoney(goal) {
  const done = await openModal({
    title: `Add money to ${goal.name}`,
    submitLabel: "Add money",
    body: `
      <p class="small muted">${money(goal.currentAmount)} saved of ${money(goal.targetAmount)}. ${money(goal.remainingAmount)} to go.</p>
      <div class="field">
        <label for="m-amount">Amount</label>
        <div class="input-group"><span class="addon">${currencySymbol()}</span>
          <input class="input" id="m-amount" name="amount" type="number" min="1" step="1" placeholder="5000"></div>
      </div>
      <div class="field">
        <label for="m-memo">Note (optional)</label>
        <input class="input" id="m-memo" name="memo" maxlength="60" placeholder="Manual contribution">
      </div>`,
    onSubmit: (form) => {
      const data = formData(form);
      return savingsApi.addContribution(goal.id, { amount: Number(data.amount), memo: data.memo });
    },
  });
  if (done) {
    toast(`Added to ${goal.name}`);
    load();
  }
}

async function goalForm(goal = null) {
  const done = await openModal({
    title: goal ? "Edit savings goal" : "New savings goal",
    submitLabel: goal ? "Save changes" : "Create goal",
    body: `
      <div class="field">
        <label for="m-name">Goal name</label>
        <input class="input" id="m-name" name="name" maxlength="40" placeholder="e.g. Emergency Fund" value="${esc(goal?.name || "")}">
      </div>
      <div class="field">
        <label for="m-target">Target amount</label>
        <div class="input-group"><span class="addon">${currencySymbol()}</span>
          <input class="input" id="m-target" name="targetAmount" type="number" min="1" step="1" placeholder="100000" value="${goal?.targetAmount ?? ""}"></div>
      </div>
      <div class="field">
        <label for="m-date">Target date</label>
        <input class="input" id="m-date" name="targetDate" type="date" min="${todayIso()}" value="${goal?.targetDate || ""}">
      </div>`,
    onSubmit: (form) => {
      const data = formData(form);
      const payload = { name: data.name, targetAmount: Number(data.targetAmount), targetDate: data.targetDate };
      return goal ? savingsApi.update(goal.id, payload) : savingsApi.create(payload);
    },
  });
  if (done) {
    toast(goal ? "Goal updated" : "Goal created");
    load();
  }
}

async function deleteGoal(goal) {
  const ok = await confirmDialog({
    title: "Delete savings goal?",
    message: `"${goal.name}" and its ${money(goal.currentAmount)} contribution history will be removed. This cannot be undone.`,
  });
  if (!ok) return;
  try {
    await savingsApi.remove(goal.id);
    toast("Goal deleted");
    load();
  } catch (err) {
    toastError(err);
  }
}
