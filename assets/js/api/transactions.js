/**
 * transactions.js - Epic 2 (Income and Expense Tracking).
 * Backend classes: Transaction (abstract), Income, Expense, Category.
 */
import { http, query } from "./client.js";

export const transactionApi = {
  /**
   * filters: { type: "INCOME"|"EXPENSE", categoryId, from: "YYYY-MM-DD", to, q, limit }
   * Maps to User.filterTransactions(c, from, to).
   */
  list(filters = {}) {
    return http.get(`/transactions${query(filters)}`);
  },

  get(id) {
    return http.get(`/transactions/${id}`);
  },

  /** { type, amount, categoryId, date, paymentMethod, description } */
  create(transaction) {
    return http.post("/transactions", transaction);
  },

  update(id, transaction) {
    return http.put(`/transactions/${id}`, transaction);
  },

  remove(id) {
    return http.del(`/transactions/${id}`);
  },
};

export const categoryApi = {
  /** type is optional: "INCOME" or "EXPENSE" */
  list(type) {
    return http.get(`/categories${query({ type })}`);
  },
};

export const PAYMENT_METHODS = ["M-PESA", "Cash", "Bank transfer", "Debit card", "Credit card"];
