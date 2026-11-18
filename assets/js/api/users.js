/**
 * users.js - Epic 1 (User Management): profile, preferences, password, delete account.
 * Backend class: User (updateProfile, changePassword).
 */
import { http } from "./client.js";
import { session } from "../core/session.js";

async function saveAndCache(promise) {
  const user = await promise;
  session.updateUser(user);
  return user;
}

export const userApi = {
  me() {
    return saveAndCache(http.get("/users/me"));
  },

  /** { firstName, lastName, email, phone, country, currency } */
  updateProfile(profile) {
    return saveAndCache(http.put("/users/me", profile));
  },

  /** { language, currency, weekStart, compactNumbers } */
  updatePreferences(prefs) {
    return saveAndCache(http.put("/users/me/preferences", prefs));
  },

  changePassword(currentPassword, newPassword) {
    return http.put("/users/me/password", { currentPassword, newPassword });
  },

  async deleteAccount() {
    await http.del("/users/me");
    session.clear();
  },

  /** In-app budget alerts produced by BudgetMonitor + InAppNotifier. */
  notifications() {
    return http.get("/notifications");
  },
};
