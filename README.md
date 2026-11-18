# PesaPlan frontend

Frontend for the Personal Finance Manager project. It uses plain HTML, CSS and JavaScript with no framework and no build step.
The Java backend lives in a separate repository and talks to this one only through the REST API in [`docs/API.md`](docs/API.md).

## Run it

The pages use JavaScript modules (`<script type="module">`), so they must be served over HTTP. Double-clicking a file to open it with `file://` will not work.

Pick one:

- **VS Code:** install the "Live Server" extension, right-click `index.html` and choose "Open with Live Server".
- **Python:** `python -m http.server 5500`, then open http://localhost:5500
- **Node:** `npx serve -l 5500`

Log in with the demo account: **ann.micheni@email.com** / **password123**

## Mock mode and the real backend

Open `assets/js/config.js`:

```js
export const API_BASE_URL = "http://localhost:8080/api";
export const USE_MOCK = true;
```

- `USE_MOCK = true`: every request is answered in the browser by `assets/js/api/mock/mock-server.js`, using demo data. You can build and demo every screen before the backend exists. Changes last until you close the tab.
- `USE_MOCK = false`: requests go to `API_BASE_URL`. The backend must follow `docs/API.md` and allow CORS from the frontend's address.

The mock server is also a working example of the API. If the backend team is unsure what an endpoint should return, they can read the matching `route(...)` in `mock-server.js`.

## Folder structure

```
pesaplan-frontend/
├── index.html                  redirects to the login page
├── pages/                      one HTML file per screen
│   ├── login.html              Log In + Reset Password
│   ├── register.html           Register
│   ├── dashboard.html          View Dashboard
│   ├── transactions.html       View / Filter / Delete Transactions
│   ├── add-transaction.html    Add Income, Add Expense, Edit Transaction (?id=)
│   ├── budgets.html            Manage Budgets
│   ├── savings.html            Manage Savings Goals, Add Contribution
│   ├── reports.html            Generate Report, Export Report
│   ├── profile.html            Manage Profile
│   └── settings.html           Preferences, notifications, password, delete account
├── assets/
│   ├── css/
│   │   ├── base.css            design tokens (colours, radius, fonts) and reset
│   │   ├── layout.css          sidebar, topbar, content area, grids, responsive rules
│   │   ├── components.css      cards, buttons, forms, tables, progress, modal, toast
│   │   └── pages.css           layout that belongs to a single screen
│   ├── img/favicon.svg
│   └── js/
│       ├── config.js           API URL and the mock switch
│       ├── core/session.js     token + logged-in user, route guard
│       ├── api/                one file per backend area
│       │   ├── client.js       fetch wrapper: token, JSON, errors (the only file that calls fetch)
│       │   ├── errors.js       ApiError
│       │   ├── auth.js         Epic 1
│       │   ├── users.js        Epic 1
│       │   ├── transactions.js Epic 2
│       │   ├── budgets.js      Epic 3
│       │   ├── savings.js      Epic 4
│       │   ├── reports.js      Epics 5 and 6
│       │   └── mock/           fake backend + demo data
│       ├── components/         shared UI: layout (sidebar/topbar), charts, icons, ui helpers
│       ├── utils/              formatting, DOM helpers, category colours
│       └── pages/              one script per HTML page
└── docs/API.md                 the contract with the backend repo
```

### How a page works

Every logged-in page follows the same pattern, so once you understand one you understand them all:

1. The HTML has an empty `<aside id="sidebar">` and `<header id="topbar">`, plus the page's own markup with ids.
2. Its script in `assets/js/pages/` calls `await initLayout("budgets")`. That function checks the user is logged in (or sends them to the login page) and draws the sidebar and topbar.
3. The script calls a function in `assets/js/api/` (for example `budgetApi.list(period)`) and fills the page with the result.

Pages never call `fetch` directly and never do money calculations that belong on the backend. Totals, `spent`, progress and percentages all come from the API.

## Who owns what

| Member | Pages | JS |
|---|---|---|
| Member 1 (Epics 1 and 2) | login, register, profile, settings, transactions, add-transaction | `api/auth.js`, `api/users.js`, `api/transactions.js`, matching `pages/*.js` |
| Member 2 (Epics 3 and 4) | budgets, savings | `api/budgets.js`, `api/savings.js`, matching `pages/*.js` |
| Member 3 (Epics 5 and 6) | dashboard, reports | `api/reports.js`, `components/charts.js`, matching `pages/*.js` |
| Shared (agree changes in review) | | `css/*`, `components/layout.js`, `components/ui.js`, `utils/*`, `api/client.js`, `docs/API.md` |

## Conventions

- **Security:** anything the user typed must go through `esc()` from `utils/dom.js` before it goes into `innerHTML`. The backend must still validate and escape everything, because frontend checks are only there for quick feedback.
- **Styling:** use the tokens in `base.css` (`var(--primary)`) instead of hard-coded colours.
- **Money:** always format with `money()` from `utils/format.js`. It respects the user's currency and compact number setting.
- **Errors:** `catch (err) { toastError(err); }`. For forms, `showFieldErrors(form, err.fields)` puts the backend's messages under each input.
- **Branches:** `main` is always working. Use one branch per Jira task (`feature/PFM-12-budget-alerts`) and open a pull request for review.

## Not built yet

- An Admin screen (Manage Users, Suspend Account, View System Reports). There is no design for it yet.
- Language switching. The setting is saved, but all text is in English.
