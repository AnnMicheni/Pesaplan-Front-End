/**
 * login.js - Log In and Reset Password use cases.
 */
import { authApi } from "../api/auth.js";
import { session } from "../core/session.js";
import { USE_MOCK } from "../config.js";
import { $, formData, withBusy } from "../utils/dom.js";

if (session.isLoggedIn()) location.replace("dashboard.html");

const loginView = $("#login-view");
const resetView = $("#reset-view");
const loginForm = $("#login-form");
const loginError = $("#login-error");

if (USE_MOCK) $("#demo-hint").hidden = false;

/** Only follow ?next= to our own pages, never to another site. */
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[a-z-]+\.html(\?.*)?$/.test(next) ? next : "dashboard.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const { email, password } = formData(loginForm);
  if (!email || !password) {
    loginError.textContent = "Enter your email and password.";
    loginError.hidden = false;
    return;
  }
  const button = loginForm.querySelector('[type="submit"]');
  try {
    await withBusy(button, "Logging in...", () => authApi.login(email, password));
    location.replace(nextPage());
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  }
});

$("#show-reset").addEventListener("click", () => {
  loginView.hidden = true;
  resetView.hidden = false;
  $("#reset-email").value = $("#email").value;
  $("#reset-email").focus();
});

$("#back-to-login").addEventListener("click", () => {
  resetView.hidden = true;
  loginView.hidden = false;
});

$("#reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { email } = formData(e.target);
  if (!email) return;
  const button = e.target.querySelector('[type="submit"]');
  const result = await withBusy(button, "Sending...", () => authApi.requestPasswordReset(email));
  const done = $("#reset-done");
  done.textContent = result.message;
  done.hidden = false;
});
