/**
 * transactions.js - View, Filter, Edit and Delete Transactions (Epic 2).
 * Filters are kept in the URL (?type=EXPENSE&from=...) so a filtered
 * view can be bookmarked and the topbar search can link straight here.
 */
import { initLayout } from "../components/layout.js";
import { transactionApi, categoryApi } from "../api/transactions.js";
import { icon } from "../components/icons.js";
import { confirmDialog, emptyState, skeletonRows, toast, toastError } from "../components/ui.js";
import { $, esc, formData } from "../utils/dom.js";
import { money, formatDate } from "../utils/format.js";
import { categoryEmoji } from "../utils/categories.js";

const user = await initLayout("transactions");
const form = $("#filters");
const body = $("#tx-body");
let categories = [];
let allRows = [];
let shown = 0;
const PAGE_SIZE = 25;

if (user) {
  categories = await categoryApi.list();
  fillCategorySelect();
  readFiltersFromUrl();
  load();

  let timer;
  form.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(applyFilters, 250); // wait until the user stops typing
  });
  form.addEventListener("change", applyFilters);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("#clear-filters").addEventListener("click", () => setTimeout(applyFilters));
  body.addEventListener("click", onRowAction);
}

function fillCategorySelect() {
  const type = form.elements.type.value;
  const select = form.elements.categoryId;
  const current = select.value;
  const options = categories
    .filter((c) => !type || c.type === type)
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join("");
  select.innerHTML = `<option value="">All categories</option>${options}`;
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  for (const name of ["q", "type", "from", "to"]) {
    if (params.has(name)) form.elements[name].value = params.get(name);
  }
  fillCategorySelect();
  if (params.has("categoryId")) form.elements.categoryId.value = params.get("categoryId");
}

function applyFilters() {
  fillCategorySelect();
  const filters = formData(form);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  load();
}

async function load() {
  body.innerHTML = `<tr><td colspan="7">${skeletonRows(5)}</td></tr>`;
  try {
    const filters = formData(form);
    if (filters.from && filters.to && filters.from > filters.to) {
      body.innerHTML = `<tr><td colspan="7">${emptyState("The From date must be before the To date.", "📅")}</td></tr>`;
      $("#tx-footer").textContent = "";
      return;
    }
    allRows = await transactionApi.list(filters);
    shown = PAGE_SIZE;
    render();
  } catch (err) {
    toastError(err);
    body.innerHTML = "";
  }
}

function render() {
  const list = allRows.slice(0, shown);
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7">${emptyState("No transactions match these filters.", "🔍")}</td></tr>`;
    $("#tx-footer").textContent = "";
    return;
  }

  body.innerHTML = list
    .map((t) => {
      const income = t.type === "INCOME";
      return `<tr>
        <td class="muted">${formatDate(t.date)}</td>
        <td><div class="desc"><span class="emoji-tile round">${categoryEmoji(t.categoryName)}</span>${esc(t.description || t.categoryName)}</div></td>
        <td>${esc(t.categoryName)}</td>
        <td class="muted">${esc(t.paymentMethod)}</td>
        <td><span class="badge ${income ? "" : "danger"}">${income ? "Income" : "Expense"}</span></td>
        <td class="right num ${income ? "text-success" : "text-danger"}"><strong>${money(t.amount, { sign: true, type: t.type })}</strong></td>
        <td class="right"><div class="row-actions">
          <a class="icon-btn" href="add-transaction.html?id=${t.id}" aria-label="Edit transaction">${icon("edit")}</a>
          <button class="icon-btn" data-delete="${t.id}" aria-label="Delete transaction">${icon("trash")}</button>
        </div></td>
      </tr>`;
    })
    .join("");

  // totals cover every matching transaction, not only the rows on screen
  const income = allRows.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expenses = allRows.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const more = allRows.length - list.length;
  $("#tx-footer").innerHTML = `
    <span>Showing ${list.length} of ${allRows.length} transaction${allRows.length === 1 ? "" : "s"}</span>
    ${more > 0 ? `<button class="btn" id="show-more">Show ${Math.min(more, PAGE_SIZE)} more</button>` : ""}
    <span>In <strong class="text-success">${money(income)}</strong> &nbsp; Out <strong class="text-danger">${money(expenses)}</strong></span>`;
  $("#show-more")?.addEventListener("click", () => {
    shown += PAGE_SIZE;
    render();
  });
}

async function onRowAction(e) {
  const button = e.target.closest("[data-delete]");
  if (!button) return;
  const ok = await confirmDialog({
    title: "Delete transaction?",
    message: "This removes it from your history, budgets and reports. This cannot be undone.",
  });
  if (!ok) return;
  try {
    await transactionApi.remove(button.dataset.delete);
    toast("Transaction deleted");
    load();
  } catch (err) {
    toastError(err);
  }
}
