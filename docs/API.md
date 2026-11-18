# PesaPlan API contract

This is the agreement between the frontend repo and the Java backend repo.
The frontend's mock server (`assets/js/api/mock/mock-server.js`) follows it exactly, so if the two disagree, update this file first and then both sides.

## General rules

| Rule | Value |
|---|---|
| Base URL | `http://localhost:8080/api` (set in `assets/js/config.js`) |
| Format | JSON in, JSON out, `Content-Type: application/json` |
| Auth | `Authorization: Bearer <token>` on every route except `/auth/*` |
| Dates | `"YYYY-MM-DD"` (Java `LocalDate.toString()`) |
| Months | `"YYYY-MM"` (Java `YearMonth.toString()`) |
| Money | plain numbers, e.g. `12500.5` (use `BigDecimal` in Java, send as a number) |
| Enums | `"INCOME"` / `"EXPENSE"`, `"ACTIVE"` / `"SUSPENDED"`, `"USER"` / `"ADMIN"` |
| IDs | numbers |

### Errors

Every error has a status code and this body:

```json
{ "message": "Please check the highlighted fields.", "fields": { "amount": "Enter an amount greater than 0." } }
```

`fields` is optional. When it is present, the frontend shows each message under the matching input.

| Status | When |
|---|---|
| 400 | Validation failed (send `fields`) |
| 401 | Missing or expired token, or a wrong password on login. The frontend sends the user to the login page. |
| 403 | Account suspended, or a user trying an admin route |
| 404 | The id does not exist or belongs to another user |

### CORS

The frontend runs on a different port (for example `http://localhost:5500`), so the backend must send:

```
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

It must also answer `OPTIONS` preflight requests with `204`.

---

## Objects

**User**
```json
{
  "id": 1, "firstName": "Ann", "lastName": "Micheni", "email": "ann.micheni@email.com",
  "phone": "+254 712 345 678", "country": "Kenya", "currency": "KES",
  "language": "en", "weekStart": "MONDAY", "compactNumbers": false,
  "budgetAlerts": true, "goalReminders": true,
  "role": "USER", "status": "ACTIVE", "memberSince": "2025-03-14"
}
```
Never send the password or its hash.

**Category** `{ "id": 11, "name": "Food & groceries", "type": "EXPENSE" }`

**Transaction**
```json
{ "id": 1042, "type": "EXPENSE", "amount": 2500, "categoryId": 11, "categoryName": "Food & groceries",
  "date": "2026-11-18", "paymentMethod": "M-PESA", "description": "Groceries" }
```

**Budget** (the server works out `spent` and the rest from transactions)
```json
{ "id": 7, "categoryId": 11, "categoryName": "Food & groceries", "period": "2026-11",
  "limitAmount": 15000, "spent": 9150, "remaining": 5850, "usagePercent": 61, "exceeded": false }
```

**SavingsGoal**
```json
{ "id": 3, "name": "Emergency Fund", "targetAmount": 100000, "targetDate": "2027-01-28",
  "currentAmount": 60000, "remainingAmount": 40000, "progress": 60, "completed": false }
```

**Contribution** `{ "id": 90, "goalId": 3, "goalName": "Emergency Fund", "amount": 10000, "date": "2026-11-01", "memo": "Automatic deposit" }`

---

## Endpoints

### Auth (FinanceApp)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ firstName, lastName, email, password }` | `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` (401 if wrong) |
| POST | `/auth/logout` | none | `{ ok: true }` |
| POST | `/auth/reset-password` | `{ email }` | `{ message }` (always 200, so nobody can test which emails exist) |

### User (User)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/users/me` | none | User |
| PUT | `/users/me` | `{ firstName, lastName, email, phone, country, currency }` | User |
| PUT | `/users/me/preferences` | any of `{ language, currency, weekStart, compactNumbers, budgetAlerts, goalReminders }` | User |
| PUT | `/users/me/password` | `{ currentPassword, newPassword }` | `{ ok: true }` (400 with `fields.currentPassword` if wrong) |
| DELETE | `/users/me` | none | `{ ok: true }` and deletes all the user's data |
| GET | `/notifications` | none | `[{ id, level: "warning" or "danger", title, message }]` from BudgetMonitor |

### Categories and transactions (Transaction, Income, Expense, Category)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/categories?type=EXPENSE` | none | Category[] (`type` optional) |
| GET | `/transactions?type=&categoryId=&from=&to=&q=&limit=` | none | Transaction[], newest first (every filter optional) |
| GET | `/transactions/{id}` | none | Transaction |
| POST | `/transactions` | `{ type, amount, categoryId, date, paymentMethod, description }` | Transaction |
| PUT | `/transactions/{id}` | same as POST | Transaction |
| DELETE | `/transactions/{id}` | none | `{ ok: true }` |

Validation: amount > 0, the category's type matches `type`, the date is not in the future and `description` is at most 120 characters.
After saving an EXPENSE, run `BudgetMonitor.checkBudget(user, expense)`.

### Budgets (Budget)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/budgets?period=2026-11` | none | Budget[] for that month |
| POST | `/budgets` | `{ categoryId, limitAmount, period }` | Budget (400 if that category already has a budget for that month) |
| PUT | `/budgets/{id}` | `{ limitAmount }` | Budget |
| DELETE | `/budgets/{id}` | none | `{ ok: true }` |

### Savings goals (SavingsGoal, SavingsContribution)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/goals` | none | SavingsGoal[] |
| POST | `/goals` | `{ name, targetAmount, targetDate }` | SavingsGoal |
| PUT | `/goals/{id}` | same as POST | SavingsGoal |
| DELETE | `/goals/{id}` | none | `{ ok: true }` (also deletes its contributions) |
| POST | `/goals/{id}/contributions` | `{ amount, memo }` | the updated SavingsGoal |
| GET | `/contributions?limit=5` | none | Contribution[], newest first |

### Dashboard (FinancialSummary)

`GET /dashboard?period=2026-11` returns:

```json
{
  "period": "2026-11",
  "totalIncome": 20950, "totalExpenses": 38250, "balance": 281100, "savings": 142800,
  "changes": { "income": -79.4, "expenses": -11.4, "balance": -5.8, "savings": 20.0 },
  "weekly": [ { "label": "Week 1", "income": 0, "expenses": 24000 } ],
  "expenseBreakdown": [ { "categoryId": 10, "categoryName": "Housing", "amount": 15000, "percent": 39.2 } ],
  "budgets": [ "Budget, most used first" ],
  "recentTransactions": [ "Transaction, latest 5" ],
  "goals": [ "SavingsGoal, first 3" ]
}
```

- `changes` are percentages against last month. Send `null` when last month was 0.
- `balance` is all income minus all expenses, ever.
- Week 1 is days 1 to 7, Week 2 is 8 to 14, Week 3 is 15 to 21 and Week 4 is 22 to the end of the month.

### Reports (ReportGenerator, MonthlySummaryReport, ExpenseBreakdownReport, Report)

`GET /reports/summary?months=6` returns:

```json
{
  "months": 6, "from": "2026-06", "to": "2026-11",
  "totalIncome": 540400, "totalExpenses": 259300, "netSavings": 281100,
  "savingsRate": 52.0, "avgMonthlySpend": 43216.67, "monthlyBudget": 50000,
  "changes": { "income": null, "expenses": null },
  "monthly": [ { "period": "2026-06", "income": 95000, "expenses": 41000 } ],
  "categoryBreakdown": [ "breakdown over the whole range" ],
  "currentMonthBreakdown": [ "breakdown for this month only" ]
}
```

`GET /reports/export?months=6&format=csv` returns a file with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="pesaplan-report-2026-06-to-2026-11.csv"`.
