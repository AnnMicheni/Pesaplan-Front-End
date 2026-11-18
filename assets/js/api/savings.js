/**
 * savings.js - Epic 4 (Savings Goals).
 * Backend classes: SavingsGoal, SavingsContribution.
 */
import { http, query } from "./client.js";

export const savingsApi = {
  /** Returns [{ id, name, targetAmount, targetDate, currentAmount, progress, completed }] */
  list() {
    return http.get("/goals");
  },

  /** { name, targetAmount, targetDate } */
  create(goal) {
    return http.post("/goals", goal);
  },

  update(id, goal) {
    return http.put(`/goals/${id}`, goal);
  },

  remove(id) {
    return http.del(`/goals/${id}`);
  },

  /** SavingsGoal.addContribution(amount, memo) */
  addContribution(goalId, { amount, memo }) {
    return http.post(`/goals/${goalId}/contributions`, { amount, memo });
  },

  /** Latest contributions across all goals. */
  recentContributions(limit = 5) {
    return http.get(`/contributions${query({ limit })}`);
  },
};
