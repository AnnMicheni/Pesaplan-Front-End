/**
 * reports.js - Epic 5 (Dashboard) and Epic 6 (Reports and Analytics).
 * Backend classes: FinancialSummary, ReportGenerator, MonthlySummaryReport,
 * ExpenseBreakdownReport, Report.
 */
import { http, query, requestFile } from "./client.js";

export const dashboardApi = {
  /** Everything the dashboard needs in one call. period: "YYYY-MM" */
  summary(period) {
    return http.get(`/dashboard${query({ period })}`);
  },
};

export const reportApi = {
  /** months: how many months back, including the current one. */
  summary(months = 6) {
    return http.get(`/reports/summary${query({ months })}`);
  },

  /** Downloads the report as a CSV file. Report.export(format) */
  async export(months = 6, format = "csv") {
    const { blob, filename } = await requestFile(`/reports/export${query({ months, format })}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
