/**
 * auth.js - Epic 1 (User Management): register, log in, log out, reset password.
 * Backend class: FinanceApp (register, login, logout, resetPassword).
 */
import { http } from "./client.js";
import { session } from "../core/session.js";

export const authApi = {
  /** Returns { token, user } and starts the session. */
  async login(email, password) {
    const result = await http.post("/auth/login", { email, password });
    session.start(result.token, result.user);
    return result.user;
  },

  async register({ firstName, lastName, email, password }) {
    const result = await http.post("/auth/register", { firstName, lastName, email, password });
    session.start(result.token, result.user);
    return result.user;
  },

  async logout() {
    try {
      await http.post("/auth/logout");
    } finally {
      session.clear();
      location.replace("login.html");
    }
  },

  requestPasswordReset(email) {
    return http.post("/auth/reset-password", { email });
  },
};
