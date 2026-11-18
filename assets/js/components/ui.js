/**
 * ui.js - small HTML builders and interactive helpers shared by pages:
 * stat cards, progress bars, rings, toasts, modals and confirm dialogs.
 */
import { icon } from "./icons.js";
import { esc, showFieldErrors } from "../utils/dom.js";

/* ---------- Pure HTML builders ---------- */

/**
 * statCard({ label, value, icon, tone, meta, delta })
 * delta: { value: 12.5, goodWhenUp: true }  -> "↑ 12.5% vs last month"
 */
export function statCard({ label, value, iconName, tone = "", meta = "", delta = null, deltaSuffix = "vs last month" }) {
  let metaHtml = esc(meta);
  if (delta && Number.isFinite(delta.value)) {
    const up = delta.value >= 0;
    const good = delta.goodWhenUp === false ? !up : up;
    metaHtml = `<span class="${good ? "delta-up" : "delta-down"}">${up ? "↑" : "↓"} ${Math.abs(delta.value).toFixed(1)}%</span> ${esc(deltaSuffix)}`;
  }
  return `
    <div class="card stat">
      <div class="stat-icon ${tone}">${icon(iconName)}</div>
      <div>
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value">${esc(value)}</div>
        <div class="stat-meta">${metaHtml}</div>
      </div>
    </div>`;
}

export function progressBar(pct, color = "var(--success)", thin = false) {
  const width = Math.max(0, Math.min(100, pct));
  return `<div class="progress${thin ? " thin" : ""}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${width}%;background:${color}"></span></div>`;
}

/** Circular progress used for budget usage and savings rate. */
export function ring(pct, { size = 110, stroke = 10, color = "var(--success)", value, sub = "" } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - shown / 100);
  return `
    <div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#edf1f5" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-label">
        <div class="ring-value">${esc(value ?? `${Math.round(pct)}%`)}</div>
        <div class="ring-sub">${esc(sub)}</div>
      </div>
    </div>`;
}

export function emptyState(message, emoji = "🗂️") {
  return `<div class="empty"><div class="emoji">${emoji}</div>${esc(message)}</div>`;
}

export function skeletonRows(count = 3, height = 18) {
  return Array.from({ length: count }, () => `<div class="skeleton" style="height:${height}px;margin:12px 0"></div>`).join("");
}

/* ---------- Toasts ---------- */

let stack;

export function toast(message, type = "success") {
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `${icon(type === "error" ? "info" : "checkCircle")}<span>${esc(message)}</span>`;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

/** Show an ApiError (or any error) as a red toast. */
export function toastError(err) {
  toast(err?.message || "Something went wrong. Please try again.", "error");
}

/* ---------- Modal ---------- */

/**
 * openModal({ title, body, submitLabel, onSubmit, danger })
 * body is an HTML string containing form fields.
 * onSubmit(form) may throw an ApiError: its fields are shown under the inputs
 * and the modal stays open. Resolves true when submitted, false when cancelled.
 */
export function openModal({ title, body, submitLabel = "Save", onSubmit, danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.innerHTML = `
      <form method="dialog" novalidate>
        <div class="modal-header">
          <h2>${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon("close")}</button>
        </div>
        <div class="modal-body">${body}<div class="alert" data-error hidden></div></div>
        <div class="modal-footer">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}">${esc(submitLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const form = dialog.querySelector("form");
    const errorBox = dialog.querySelector("[data-error]");
    let done = false;

    const close = (result) => {
      if (done) return;
      done = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(false)));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(false);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await onSubmit?.(form);
        close(true);
      } catch (err) {
        showFieldErrors(form, err.fields || {});
        if (!err.fields || Object.keys(err.fields).length === 0) {
          errorBox.textContent = err.message || "Something went wrong.";
          errorBox.hidden = false;
        }
      } finally {
        submit.disabled = false;
      }
    });

    dialog.showModal();
    dialog.querySelector("input, select, textarea")?.focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = "Delete", danger = true }) {
  return openModal({
    title,
    body: `<p class="muted">${esc(message)}</p>`,
    submitLabel: confirmLabel,
    danger,
    onSubmit: () => {},
  });
}
