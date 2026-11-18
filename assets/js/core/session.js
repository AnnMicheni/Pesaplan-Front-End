/**
 * session.js - keeps the logged-in user's token and profile between pages.
 * sessionStorage is cleared when the tab closes, which suits a finance app.
 * Every access is wrapped in try/catch because storage can be blocked.
 */
const TOKEN_KEY = "pfm.token";
const USER_KEY = "pfm.user";

function read(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the user will simply be asked to log in again */
  }
}

export const session = {
  getToken() {
    return read(TOKEN_KEY);
  },

  getUser() {
    const raw = read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /** Called after login or register. */
  start(token, user) {
    write(TOKEN_KEY, token);
    write(USER_KEY, JSON.stringify(user));
  },

  /** Called after the profile or preferences change. */
  updateUser(user) {
    write(USER_KEY, JSON.stringify(user));
  },

  clear() {
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
  },

  isLoggedIn() {
    return Boolean(read(TOKEN_KEY));
  },
};

/** Put at the top of every protected page. Sends guests to the login screen. */
export function requireAuth() {
  if (!session.isLoggedIn()) {
    const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.replace(`login.html?next=${next}`);
    return false;
  }
  return true;
}
