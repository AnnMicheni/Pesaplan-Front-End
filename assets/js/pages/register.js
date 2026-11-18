/**
 * register.js - Register use case.
 * Checks the obvious things in the browser for quick feedback;
 * the backend must still validate everything again.
 */
import { authApi } from "../api/auth.js";
import { session } from "../core/session.js";
import { $, formData, showFieldErrors, withBusy } from "../utils/dom.js";

if (session.isLoggedIn()) location.replace("dashboard.html");

const form = $("#register-form");
const errorBox = $("#register-error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const data = formData(form);

  const fields = {};
  if (!data.firstName) fields.firstName = "Enter your first name.";
  if (!data.lastName) fields.lastName = "Enter your last name.";
  if (!data.email) fields.email = "Enter your email address.";
  if (data.password.length < 8) fields.password = "Use at least 8 characters.";
  if (data.password !== data.confirm) fields.confirm = "The passwords do not match.";
  showFieldErrors(form, fields);
  if (Object.keys(fields).length) return;

  try {
    await withBusy(form.querySelector('[type="submit"]'), "Creating account...", () => authApi.register(data));
    location.replace("dashboard.html");
  } catch (err) {
    showFieldErrors(form, err.fields);
    if (!Object.keys(err.fields || {}).length) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  }
});
