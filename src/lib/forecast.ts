import { differenceInCalendarDays, endOfMonth, getDate, isAfter, isSameDay, startOfMonth } from "date-fns";

export interface ForecastInput {
  accountsBalance: number;
  transactions: { amount: number; type: "income" | "expense"; occurred_on: string }[];
  recurring: { amount: number; day_of_month: number; kind: "bill" | "salary" | "subscription" }[];
  planned: { amount: number; due_date: string; completed: boolean }[];
}

export interface ForecastResult {
  currentBalance: number;
  daysLeft: number;
  expectedIncomeRemaining: number;
  recurringBillsRemaining: number;
  plannedRemaining: number;
  avgDailyVariableSpend: number;
  projectedMonthEnd: number;
  safeDailySpend: number;
  runOutDate: Date | null;
}

export function computeForecast(input: ForecastInput, today: Date = new Date()): ForecastResult {
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysLeft = Math.max(1, differenceInCalendarDays(monthEnd, today) + 1);
  const todayDay = getDate(today);

  // Variable spend so far this month (exclude recurring matches roughly = use all expense tx)
  const thisMonthExpenses = input.transactions.filter(
    (t) => t.type === "expense" && new Date(t.occurred_on) >= monthStart && new Date(t.occurred_on) <= today,
  );
  const totalSpentSoFar = thisMonthExpenses.reduce((s, t) => s + Number(t.amount), 0);
  const daysElapsed = Math.max(1, differenceInCalendarDays(today, monthStart) + 1);
  const avgDailyVariableSpend = totalSpentSoFar / daysElapsed;

  const recurringRemaining = input.recurring
    .filter((r) => r.kind !== "salary" && r.day_of_month >= todayDay)
    .reduce((s, r) => s + Number(r.amount), 0);

  const expectedIncomeRemaining = input.recurring
    .filter((r) => r.kind === "salary" && r.day_of_month >= todayDay)
    .reduce((s, r) => s + Number(r.amount), 0);

  const plannedRemaining = input.planned
    .filter((p) => !p.completed && new Date(p.due_date) >= today && new Date(p.due_date) <= monthEnd)
    .reduce((s, p) => s + Number(p.amount), 0);

  const projectedMonthEnd =
    input.accountsBalance +
    expectedIncomeRemaining -
    recurringRemaining -
    plannedRemaining -
    avgDailyVariableSpend * daysLeft;

  const committed = recurringRemaining + plannedRemaining;
  const safeDailySpend = Math.max(0, (input.accountsBalance + expectedIncomeRemaining - committed) / daysLeft);

  // Run-out day simulation
  let bal = input.accountsBalance;
  let runOut: Date | null = null;
  for (let i = 0; i < daysLeft; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const d = getDate(day);
    for (const r of input.recurring) {
      if (r.day_of_month === d) {
        bal += r.kind === "salary" ? Number(r.amount) : -Number(r.amount);
      }
    }
    for (const p of input.planned) {
      if (!p.completed && isSameDay(new Date(p.due_date), day)) bal -= Number(p.amount);
    }
    bal -= avgDailyVariableSpend;
    if (bal < 0 && !runOut) {
      runOut = day;
    }
  }

  return {
    currentBalance: input.accountsBalance,
    daysLeft,
    expectedIncomeRemaining,
    recurringBillsRemaining: recurringRemaining,
    plannedRemaining,
    avgDailyVariableSpend,
    projectedMonthEnd,
    safeDailySpend,
    runOutDate: runOut && isAfter(runOut, today) ? runOut : null,
  };
}

export function canAfford(itemCost: number, forecast: ForecastResult): "yes" | "tight" | "no" {
  const headroom = forecast.projectedMonthEnd - itemCost;
  if (headroom > forecast.avgDailyVariableSpend * 5) return "yes";
  if (headroom > 0) return "tight";
  return "no";
}
