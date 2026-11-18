/**
 * budgets.js - Epic 3 (Budget Management).
 * Backend classes: Budget, BudgetMonitor.
 * The server returns `spent` with each budget (User.getTotalSpent),
 * so the frontend never adds up transactions itself.
 */
import { http, query } from "./client.js";

export const budgetApi = {
  /** period: "YYYY-MM". Returns [{ id, categoryId, categoryName, limitAmount, spent, period }] */
  list(period) {
    return http.get(`/budgets${query({ period })}`);
  },

  /** { categoryId, limitAmount, period } */
  create(budget) {
    return http.post("/budgets", budget);
  },

  update(id, { limitAmount }) {
    return http.put(`/budgets/${id}`, { limitAmount });
  },

  remove(id) {
    return http.del(`/budgets/${id}`);
  },
};
