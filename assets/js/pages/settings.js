/**
 * settings.js - preferences, notification switches, change password
 * and delete account (Epic 1).
 */
import { initLayout } from "../components/layout.js";
import { userApi } from "../api/users.js";
import { openModal, toast, toastError } from "../components/ui.js";
import { $, $$, esc, formData, showFieldErrors, withBusy } from "../utils/dom.js";
import { CURRENCIES, currencySymbol } from "../utils/format.js";
import { ApiError } from "../api/errors.js";

let user = await initLayout("settings");

if (user) {
  setupTabs();
  setupGeneral();
  setupNotifications();
  setupPassword();
  $("#delete-account").addEventListener("click", deleteAccount);
}

function setupTabs() {
  const show = (name) => {
    $$("[data-tab]").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
    history.replaceState(null, "", `#${name}`);
  };
  $("#tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) show(tab.dataset.tab);
  });
  const fromHash = location.hash.slice(1);
  if (["general", "notifications", "security"].includes(fromHash)) show(fromHash);
}

function setupGeneral() {
  const form = $("#general-form");
  form.elements.currency.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code} - ${esc(c.name)}</option>`).join("");
  form.elements.language.value = user.language || "en";
  form.elements.currency.value = user.currency;
  form.elements.weekStart.value = user.weekStart || "MONDAY";
  form.elements.compactNumbers.checked = Boolean(user.compactNumbers);

  const example = () => {
    const s = currencySymbol(form.elements.currency.value);
    $("#compact-example").textContent = `Display ${s} 125,000 as ${s} 125k.`;
  };
  form.elements.currency.addEventListener("change", example);
  example();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      user = await withBusy($("#save-general"), "Saving...", () => userApi.updatePreferences(formData(form)));
      toast("Preferences saved");
    } catch (err) {
      toastError(err);
    }
  });
}

function setupNotifications() {
  const form = $("#notify-form");
  form.elements.budgetAlerts.checked = user.budgetAlerts !== false;
  form.elements.goalReminders.checked = user.goalReminders !== false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      user = await withBusy($("#save-notify"), "Saving...", () => userApi.updatePreferences(formData(form)));
      toast("Notification settings saved");
    } catch (err) {
      toastError(err);
    }
  });
}

function setupPassword() {
  const form = $("#password-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = formData(form);
    const errors = {};
    if (!data.currentPassword) errors.currentPassword = "Enter your current password.";
    if (data.newPassword.length < 8) errors.newPassword = "Use at least 8 characters.";
    if (data.newPassword !== data.confirmPassword) errors.confirmPassword = "The passwords do not match.";
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;

    try {
      await withBusy($("#save-password"), "Updating...", () => userApi.changePassword(data.currentPassword, data.newPassword));
      form.reset();
      toast("Password updated");
    } catch (err) {
      showFieldErrors(form, err.fields);
      if (!Object.keys(err.fields || {}).length) toastError(err);
    }
  });
}

async function deleteAccount() {
  const deleted = await openModal({
    title: "Delete your account?",
    submitLabel: "Delete forever",
    danger: true,
    body: `
      <p class="muted">All your transactions, budgets and savings goals will be permanently deleted. This cannot be undone.</p>
      <div class="field">
        <label for="m-confirm">Type <strong>DELETE</strong> to confirm</label>
        <input class="input" id="m-confirm" name="confirm" autocomplete="off">
      </div>`,
    onSubmit: async (form) => {
      if (formData(form).confirm !== "DELETE") {
        throw new ApiError(400, "", { confirm: "Type DELETE in capital letters." });
      }
      await userApi.deleteAccount();
    },
  });
  if (deleted) location.replace("login.html");
}
