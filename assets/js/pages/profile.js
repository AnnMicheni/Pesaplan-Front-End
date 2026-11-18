/**
 * profile.js - Manage Profile (Epic 1): view and update personal details
 * and preferred currency. User.updateProfile(...) on the backend.
 */
import { initLayout } from "../components/layout.js";
import { userApi } from "../api/users.js";
import { transactionApi } from "../api/transactions.js";
import { savingsApi } from "../api/savings.js";
import { toast, toastError } from "../components/ui.js";
import { $, esc, formData, showFieldErrors, withBusy } from "../utils/dom.js";
import { CURRENCIES, initials, monthYear } from "../utils/format.js";

let user = await initLayout("profile");
const form = $("#profile-form");
const fields = $("#profile-fields");

if (user) {
  form.elements.currency.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code} - ${esc(c.name)}</option>`).join("");
  fill(user);
  loadCounts();

  $("#edit-toggle").addEventListener("click", () => setEditing(true));
  $("#cancel-edit").addEventListener("click", () => {
    fill(user);
    showFieldErrors(form, {});
    setEditing(false);
  });
  form.addEventListener("submit", save);
}

function fill(u) {
  $("#p-avatar").textContent = initials(u);
  $("#p-name").textContent = `${u.firstName} ${u.lastName}`;
  $("#p-email").textContent = u.email;
  $("#p-since").textContent = `Member since ${monthYear(u.memberSince)}`;
  for (const name of ["firstName", "lastName", "email", "phone", "country", "currency"]) {
    form.elements[name].value = u[name] || "";
  }
}

function setEditing(on) {
  fields.disabled = !on;
  $("#form-actions").hidden = !on;
  $("#edit-toggle").hidden = on;
  if (on) form.elements.firstName.focus();
}

async function loadCounts() {
  try {
    const [tx, goals] = await Promise.all([transactionApi.list(), savingsApi.list()]);
    $("#p-tx").textContent = tx.length;
    $("#p-goals").textContent = goals.length;
  } catch {
    $("#p-tx").textContent = "-";
    $("#p-goals").textContent = "-";
  }
}

async function save(e) {
  e.preventDefault();
  const data = formData(form);
  const errors = {};
  if (!data.firstName) errors.firstName = "Enter your first name.";
  if (!data.lastName) errors.lastName = "Enter your last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Enter a valid email address.";
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  try {
    user = await withBusy($("#save-profile"), "Saving...", () => userApi.updateProfile(data));
    fill(user);
    setEditing(false);
    toast("Profile updated");
    // refresh the name in the topbar
    const greetingNode = document.querySelector(".user-chip .greeting");
    if (greetingNode) greetingNode.textContent = greetingNode.textContent.replace(/, .*$/, `, ${user.firstName}`);
    const avatar = document.querySelector(".user-chip .avatar");
    if (avatar) avatar.textContent = initials(user);
  } catch (err) {
    showFieldErrors(form, err.fields);
    toastError(err);
  }
}
