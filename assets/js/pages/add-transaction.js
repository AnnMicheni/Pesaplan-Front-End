/**
 * add-transaction.js - Add Income, Add Expense and Edit Transaction (Epic 2).
 * add-transaction.html          -> create
 * add-transaction.html?id=1042  -> edit the same form
 *
 * After an expense is saved, the backend's BudgetMonitor checks the budget
 * and may raise an alert (Budget Alert extends Add Expense). The bell in the
 * topbar shows those alerts.
 */
import { initLayout } from "../components/layout.js";
import { transactionApi, categoryApi, PAYMENT_METHODS } from "../api/transactions.js";
import { dashboardApi } from "../api/reports.js";
import { toast, toastError } from "../components/ui.js";
import { $, esc, formData, showFieldErrors, withBusy } from "../utils/dom.js";
import { money, formatDate, todayIso, currentPeriod } from "../utils/format.js";

const user = await initLayout("transactions");
const form = $("#tx-form");
const editId = new URLSearchParams(location.search).get("id");

let categories = [];
let balance = 0;
let original = null; // the transaction being edited, so the balance preview is correct

if (user) init();

async function init() {
  $("#currency-addon").textContent = user.currency;
  form.elements.paymentMethod.innerHTML =
    '<option value="">Choose account</option>' + PAYMENT_METHODS.map((m) => `<option>${esc(m)}</option>`).join("");
  form.elements.date.value = todayIso();
  form.elements.date.max = todayIso();

  try {
    const [cats, summary] = await Promise.all([categoryApi.list(), dashboardApi.summary(currentPeriod())]);
    categories = cats;
    balance = summary.balance;

    if (editId) await loadForEdit();
    else fillCategories();
  } catch (err) {
    toastError(err);
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "type") fillCategories();
    updateSummary();
  });
  form.addEventListener("input", updateSummary);
  form.addEventListener("submit", save);
  updateSummary();
}

async function loadForEdit() {
  original = await transactionApi.get(editId);
  document.title = "Edit transaction | PesaPlan";
  $("#page-title").textContent = "Edit Transaction";
  $("#crumb").textContent = "Edit transaction";

  form.elements.type.value = original.type;
  fillCategories();
  form.elements.amount.value = original.amount;
  form.elements.categoryId.value = original.categoryId;
  form.elements.date.value = original.date;
  form.elements.paymentMethod.value = original.paymentMethod;
  form.elements.description.value = original.description || "";
}

/** Only show categories that match the chosen type (an Income cannot be "Food"). */
function fillCategories() {
  const type = form.elements.type.value;
  const select = form.elements.categoryId;
  const current = select.value;
  select.innerHTML =
    '<option value="">Choose category</option>' +
    categories
      .filter((c) => c.type === type)
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function effect(type, amount) {
  return type === "INCOME" ? amount : -amount;
}

function updateSummary() {
  const data = formData(form);
  const amount = Number(data.amount) || 0;
  const isIncome = data.type === "INCOME";

  const typeBadge = $("#sum-type");
  typeBadge.textContent = isIncome ? "Income" : "Expense";
  typeBadge.className = `badge${isIncome ? "" : " danger"}`;

  $("#sum-amount").textContent = money(amount, { decimals: 2, compact: false });
  $("#sum-category").textContent = categories.find((c) => String(c.id) === data.categoryId)?.name || "Not chosen";
  $("#sum-method").textContent = data.paymentMethod || "Not chosen";
  $("#sum-date").textContent = data.date ? formatDate(data.date) : "Not chosen";
  $("#char-count").textContent = `${data.description.length} / 120`;

  let after = balance + effect(data.type, amount);
  if (original) after -= effect(original.type, original.amount);
  $("#sum-balance").textContent = money(after, { decimals: 2, compact: false });
  $("#balance-box").classList.toggle("negative", after < 0);
}

function validate(data) {
  const fields = {};
  if (!(Number(data.amount) > 0)) fields.amount = "Enter an amount greater than 0.";
  if (!data.categoryId) fields.categoryId = "Choose a category.";
  if (!data.date) fields.date = "Choose a date.";
  else if (data.date > todayIso()) fields.date = "The date cannot be in the future.";
  if (!data.paymentMethod) fields.paymentMethod = "Choose a payment method.";
  return fields;
}

async function save(e) {
  e.preventDefault();
  $("#form-error").hidden = true;
  const data = formData(form);
  const fields = validate(data);
  showFieldErrors(form, fields);
  if (Object.keys(fields).length) return;

  const payload = {
    type: data.type,
    amount: Number(data.amount),
    categoryId: Number(data.categoryId),
    date: data.date,
    paymentMethod: data.paymentMethod,
    description: data.description,
  };

  try {
    await withBusy($("#save-btn"), "Saving...", () =>
      editId ? transactionApi.update(editId, payload) : transactionApi.create(payload)
    );
    toast(editId ? "Transaction updated" : "Transaction saved");
    setTimeout(() => location.assign("transactions.html"), 600);
  } catch (err) {
    showFieldErrors(form, err.fields);
    if (!Object.keys(err.fields || {}).length) {
      $("#form-error").textContent = err.message;
      $("#form-error").hidden = false;
    } else {
      toastError(err);
    }
  }
}
