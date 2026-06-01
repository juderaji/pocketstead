# Finlo — Personal Finance OS (V1 + Forecasting)

A multi-user personal finance operating system. Currency: NGN (₦). Style: Cloud White — airy SaaS with blue accents, fintech-grade clarity.

## Stack

- TanStack Start (already scaffolded) + Lovable Cloud (Postgres + Auth)
- Email/password + Google sign-in
- Recharts for the dashboard
- date-fns for calendar logic
- RLS scoped to `auth.uid()` on every table

## Modules in V1

1. **Auth** — login/signup (email + Google), protected routes under `_authenticated`
2. **Accounts (Wallets)** — multiple accounts with balances, types (cash/bank/card)
3. **Categories** — income/expense, color-coded
4. **Transactions** — full CRUD, filterable, account + category linked
5. **Budgets** — monthly per-category with progress bars
6. **Planned Expenses** — upcoming purchases with due dates
7. **Shopping List** — items with cost, priority, planned date, financial impact
8. **Calendar** — month grid showing bills, planned purchases, salary, projected balance per day
9. **Dashboard** — net worth, income vs expense, category breakdown, top spending
10. **Forecasting engine** — rule-based: projected month-end balance, run-out date, daily safe-spend, "can I afford this?" check on shopping items

## Database (RLS on all)

`profiles`, `accounts`, `categories`, `transactions`, `budgets`, `planned_expenses`, `shopping_items`, `recurring_bills`, `calendar_events` (derived). Every row carries `user_id` with policies `auth.uid() = user_id`.

## Forecasting Logic (rule-based)

```
projected_balance = sum(account.balance)
                  + expected_income_remaining
                  - recurring_bills_remaining
                  - planned_expenses_remaining
                  - (avg_daily_variable_spend × days_remaining)

run_out_date = day when running balance crosses 0
safe_daily_spend = (projected_balance - committed) / days_remaining
```

Surfaced as a Forecast card on Dashboard + per-item "Affordability" badge on Shopping List.

## Routes

```
/                       -> marketing landing (hero + features)
/login, /signup         -> auth
/_authenticated/app                -> dashboard (default after login)
/_authenticated/accounts
/_authenticated/transactions
/_authenticated/budgets
/_authenticated/planned
/_authenticated/shopping
/_authenticated/calendar
/_authenticated/settings           -> categories, profile, currency
```

Shared sidebar nav inside the `_authenticated` layout.

## Design

- Cloud White palette (#fafbfc bg, #3b82f6 primary)
- Typography: Inter for body, Space Grotesk for numerics/headings
- Generous whitespace, soft borders, subtle elevations
- All tokens in `src/styles.css`; no ad-hoc colors in components

## Build order

1. Enable Lovable Cloud
2. Design system + landing page
3. Auth (login/signup with Google)
4. DB schema + RLS migration
5. App shell (sidebar layout)
6. Accounts + Categories + Transactions
7. Budgets + Planned + Shopping + Recurring bills
8. Calendar view
9. Forecasting engine + Dashboard
10. Polish pass

V2 (savings goals, AI insights, Power BI export, alerts) ships in a follow-up.

Approve and I'll start with step 1.