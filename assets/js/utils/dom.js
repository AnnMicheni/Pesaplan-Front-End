/**
 * dom.js - tiny helpers so page scripts stay short.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Escape text before putting it inside innerHTML.
 * ALWAYS use this for anything the user typed (descriptions, goal names...)
 * so a description like <img onerror=...> cannot run as code.
 */
export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Read a form into a plain object. Checkboxes become true/false. */
export function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") data[el.name] = el.checked;
    else if (el.type === "radio") {
      if (el.checked) data[el.name] = el.value;
    } else data[el.name] = el.value.trim();
  }
  return data;
}

/** Show server or client validation messages under each field. */
export function showFieldErrors(form, fields = {}) {
  $$(".error-text", form).forEach((n) => n.remove());
  $$(".invalid", form).forEach((n) => n.classList.remove("invalid"));
  for (const [name, message] of Object.entries(fields)) {
    const input = form.elements[name];
    if (!input) continue;
    const target = input.length && !input.tagName ? input[0] : input;
    target.classList?.add("invalid");
    const field = target.closest(".field");
    if (field) {
      const p = document.createElement("p");
      p.className = "error-text";
      p.textContent = message;
      field.appendChild(p);
    }
  }
}

/** Disable a button and swap its label while an async task runs. */
export async function withBusy(button, label, task) {
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = label;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

export function setText(selector, text, root = document) {
  const node = $(selector, root);
  if (node) node.textContent = text;
}
