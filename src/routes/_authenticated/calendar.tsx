import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import { recurringQuery, plannedQuery, accountsQuery, transactionsQuery } from "@/lib/queries";
import { formatNGN } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { BtnStyles } from "./accounts";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDate, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { computeForecast } from "@/lib/forecast";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Finlo" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(recurringQuery),
      context.queryClient.ensureQueryData(plannedQuery),
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(transactionsQuery),
    ]),
  component: CalendarPage,
});

function CalendarPage() {
  const [{ data: recurring }, { data: planned }, { data: accounts }, { data: tx }] = useSuspenseQueries({
    queries: [recurringQuery, plannedQuery, accountsQuery, transactionsQuery],
  });
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const forecast = computeForecast({
    accountsBalance: totalBalance,
    transactions: tx.map((t) => ({ amount: Number(t.amount), type: t.type as any, occurred_on: t.occurred_on })),
    recurring: recurring.map((r) => ({ amount: Number(r.amount), day_of_month: r.day_of_month, kind: r.kind as any })),
    planned: planned.map((p) => ({ amount: Number(p.amount), due_date: p.due_date, completed: p.completed })),
  });

  return (
    <>
      <PageHeader title="Calendar" subtitle="Your financial timeline" />

      <div className="rounded-2xl border border-border bg-surface shadow-soft overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-md p-1.5 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setCursor(new Date())} className="rounded-md px-3 py-1 text-xs hover:bg-secondary">Today</button>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-md p-1.5 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-secondary/40 text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = isSameMonth(d, cursor);
            const dom = getDate(d);
            const dayBills = recurring.filter((r) => r.day_of_month === dom);
            const dayPlanned = planned.filter((p) => isSameDay(new Date(p.due_date), d));
            const isToday = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className={`min-h-[88px] border-b border-r border-border p-1.5 text-xs ${inMonth ? "" : "bg-secondary/30 text-muted-foreground"}`}>
                <div className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : ""}`}>{dom}</div>
                <div className="mt-1 space-y-0.5">
                  {dayBills.slice(0, 2).map((b: any) => (
                    <div key={b.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${b.kind === "salary" ? "bg-success/15 text-success" : "bg-primary-soft text-primary"}`} title={`${b.name} ${formatNGN(b.amount)}`}>
                      {b.kind === "salary" ? "+" : "-"}{formatNGN(b.amount, { compact: true })} {b.name}
                    </div>
                  ))}
                  {dayPlanned.slice(0, 1).map((p: any) => (
                    <div key={p.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${p.completed ? "bg-success/15 text-success line-through" : "bg-warning/15 text-warning"}`}>
                      {formatNGN(p.amount, { compact: true })} {p.name}
                    </div>
                  ))}
                  {(dayBills.length + dayPlanned.length > 3) && <div className="text-[10px] text-muted-foreground">+ more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Bills this month" value={formatNGN(forecast.recurringBillsRemaining)} />
        <Stat label="Planned this month" value={formatNGN(forecast.plannedRemaining)} />
        <Stat label="Projected month-end" value={formatNGN(forecast.projectedMonthEnd)} />
      </div>
      <BtnStyles />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
