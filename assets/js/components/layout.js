/**
 * layout.js - draws the sidebar and topbar on every logged-in page.
 * Each page HTML only has <aside id="sidebar"> and <header id="topbar">;
 * this file fills them, so the menu is written once instead of 8 times.
 *
 * Usage (first lines of every page script):
 *   const user = await initLayout("dashboard");
 *   if (!user) return;
 */
import { icon } from "./icons.js";
import { session, requireAuth } from "../core/session.js";
import { userApi } from "../api/users.js";
import { authApi } from "../api/auth.js";
import { esc } from "../utils/dom.js";
import { greeting, initials } from "../utils/format.js";

const NAV = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "dashboard" },
  { id: "transactions", label: "Transactions", href: "transactions.html", icon: "transactions" },
  { id: "savings", label: "Savings", href: "savings.html", icon: "savings" },
  { id: "budgets", label: "Budgets", href: "budgets.html", icon: "budgets" },
  { id: "reports", label: "Reports and analytics", href: "reports.html", icon: "reports" },
  { divider: true },
  { id: "profile", label: "Profile", href: "profile.html", icon: "profile" },
  { id: "settings", label: "Settings", href: "settings.html", icon: "settings" },
];

function renderSidebar(active) {
  const links = NAV.map((item) => {
    if (item.divider) return '<div class="nav-divider" role="separator"></div>';
    const isActive = item.id === active;
    return `<a class="nav-link${isActive ? " active" : ""}" href="${item.href}"${isActive ? ' aria-current="page"' : ""}>
        ${icon(item.icon)}<span>${item.label}</span></a>`;
  }).join("");

  return `
    <a class="brand" href="dashboard.html">
      <div class="brand-mark">K</div>
      <div><div class="brand-name">PesaPlan</div><div class="brand-tagline">Money made simple</div></div>
    </a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="sidebar-quote">"Better money habits today, a brighter tomorrow."${icon("leaf")}</div>`;
}

function renderTopbar(user) {
  return `
    <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Open menu">${icon("menu")}</button>
    <form class="search" id="global-search" role="search" action="transactions.html">
      ${icon("search")}
      <input type="search" name="q" placeholder="Search transactions, categories, or reports..." aria-label="Search" autocomplete="off">
      <kbd>⌘ K</kbd>
    </form>
    <div class="topbar-actions">
      <div class="dropdown">
        <button class="icon-btn" id="bell" aria-label="Notifications" aria-expanded="false">
          ${icon("bell")}<span class="dot" id="bell-dot" hidden></span>
        </button>
        <div class="dropdown-panel wide" id="bell-panel" hidden>
          <div class="dropdown-title">Notifications</div>
          <div id="bell-list"><div class="empty">Loading...</div></div>
        </div>
      </div>
      <div class="dropdown">
        <button class="user-chip" id="user-menu" aria-expanded="false">
          <div class="avatar">${esc(initials(user))}</div>
          <div class="user-text">
            <div class="greeting">${esc(greeting())}, ${esc(user.firstName)}</div>
            <div class="sub">Keep going! You're doing great.</div>
          </div>
          ${icon("chevronDown")}
        </button>
        <div class="dropdown-panel" id="user-panel" hidden>
          <a class="dropdown-item" href="profile.html">${icon("profile")}Profile</a>
          <a class="dropdown-item" href="settings.html">${icon("settings")}Settings</a>
          <button class="dropdown-item" id="logout">${icon("logout")}Log out</button>
        </div>
      </div>
    </div>`;
}

/** Toggle a dropdown and close it when clicking anywhere else. */
function wireDropdown(button, panel, onOpen) {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    document.querySelectorAll(".dropdown-panel").forEach((p) => (p.hidden = true));
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) onOpen?.();
  });
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

async function loadNotifications() {
  const list = document.getElementById("bell-list");
  try {
    const items = await userApi.notifications();
    document.getElementById("bell-dot").hidden = items.length === 0;
    list.innerHTML = items.length
      ? items
          .map(
            (n) => `<div class="notification ${n.level}">
              <span class="badge-dot"></span>
              <div><div class="title" style="font-weight:600;font-size:13px">${esc(n.title)}</div>
              <div class="small muted">${esc(n.message)}</div></div></div>`
          )
          .join("")
      : '<div class="empty">You\'re all caught up.</div>';
  } catch {
    list.innerHTML = '<div class="empty">Could not load notifications.</div>';
  }
}

export async function initLayout(active) {
  if (!requireAuth()) return null;

  let user = session.getUser();
  try {
    user = await userApi.me(); // refresh, in case another tab changed the profile
  } catch {
    if (!session.isLoggedIn()) return null; // 401 already redirected to login
  }

  const sidebar = document.getElementById("sidebar");
  const topbar = document.getElementById("topbar");
  sidebar.innerHTML = renderSidebar(active);
  topbar.innerHTML = renderTopbar(user);

  // mobile menu
  document.getElementById("menu-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target)) sidebar.classList.remove("open");
  });

  // keyboard shortcut for search
  const searchInput = topbar.querySelector("#global-search input");
  searchInput.value = new URLSearchParams(location.search).get("q") || "";
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });

  wireDropdown(document.getElementById("bell"), document.getElementById("bell-panel"), loadNotifications);
  wireDropdown(document.getElementById("user-menu"), document.getElementById("user-panel"));
  document.getElementById("logout").addEventListener("click", () => authApi.logout());

  loadNotifications();
  return user;
}
