import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { recurringQuery, plannedQuery, accountsQuery, transactionsQuery, categoriesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { BtnStyles } from "./accounts";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDate, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { computeForecast } from "@/lib/forecast";
import { PlannedDialog, RecurringDialog } from "./planned";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar | Pocketstead" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(recurringQuery),
      context.queryClient.ensureQueryData(plannedQuery),
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(transactionsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]),
  component: CalendarPage,
});

function CalendarPage() {
  const [{ data: recurring }, { data: planned }, { data: accounts }, { data: tx }, { data: categories }] = useSuspenseQueries({
    queries: [recurringQuery, plannedQuery, accountsQuery, transactionsQuery, categoriesQuery],
  });
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [plannedDate, setPlannedDate] = useState<string | null>(null);
  const [editingPlanned, setEditingPlanned] = useState<any | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<any | null>(null);
  const [recurringDay, setRecurringDay] = useState<number | null>(null);
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

  const togglePlanned = async (item: any) => {
    await supabase.from("planned_expenses").update({ completed: !item.completed }).eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["planned"] });
  };

  return (
    <>
      <PageHeader title="Calendar" subtitle="Click a day to plan spending. Click an item to edit it." action={
        <button onClick={() => setRecurringDay(getDate(new Date()))} className="btn-primary"><Plus className="h-4 w-4" /> New recurring</button>
      } />

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-3 sm:p-4">
          <h2 className="font-display text-base font-semibold sm:text-lg">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-md p-1.5 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setCursor(new Date())} className="rounded-md px-3 py-1 text-xs hover:bg-secondary">Today</button>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-md p-1.5 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
        <div className="grid min-w-[630px] grid-cols-7 border-b border-border bg-secondary/40 text-xs font-medium text-muted-foreground sm:min-w-0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>

        <div className="grid min-w-[630px] grid-cols-7 sm:min-w-0">
          {days.map((d) => {
            const inMonth = isSameMonth(d, cursor);
            const dom = getDate(d);
            const dayBills = recurring.filter((r) => r.day_of_month === dom);
            const dayPlanned = planned.filter((p) => isSameDay(new Date(p.due_date), d));
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => setPlannedDate(format(d, "yyyy-MM-dd"))}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setPlannedDate(format(d, "yyyy-MM-dd")); } }}
                className={`group min-h-[96px] cursor-pointer border-b border-r border-border p-1.5 text-left text-xs transition-colors hover:bg-primary-soft/60 ${inMonth ? "" : "bg-secondary/30 text-muted-foreground"}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : ""}`}>{dom}</span>
                  <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">+</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayBills.slice(0, 2).map((b: any) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(event) => { event.stopPropagation(); setEditingRecurring(b); }}
                      className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${b.kind === "salary" ? "bg-success/15 text-success" : "bg-primary-soft text-primary"}`}
                      title={`${b.name} ${formatNGN(b.amount)}`}
                    >
                      {b.kind === "salary" ? "+" : "-"}{formatNGN(b.amount, { compact: true })} {b.name}
                    </button>
                  ))}
                  {dayPlanned.slice(0, 2).map((p: any) => (
                    <div key={p.id} className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${p.completed ? "bg-success/15 text-success line-through" : "bg-warning/15 text-warning"}`}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setEditingPlanned(p); }} className="min-w-0 flex-1 truncate text-left">
                        {formatNGN(p.amount, { compact: true })} {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); togglePlanned(p); }}
                        className="grid h-4 w-4 shrink-0 place-items-center rounded bg-white/60 text-current"
                        aria-label={p.completed ? `Mark ${p.name} incomplete` : `Mark ${p.name} complete`}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(dayBills.length + dayPlanned.length > 4) && <div className="text-[10px] text-muted-foreground">+ more</div>}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3">
        <Stat label="Bills this month" value={formatNGN(forecast.recurringBillsRemaining)} />
        <Stat label="Planned this month" value={formatNGN(forecast.plannedRemaining)} />
        <Stat label="Projected month-end" value={formatNGN(forecast.projectedMonthEnd)} />
      </div>
      {plannedDate && <PlannedDialog initialDate={plannedDate} onClose={() => setPlannedDate(null)} categories={categories.filter((c: any) => c.kind === "expense")} />}
      {editingPlanned && <PlannedDialog item={editingPlanned} onClose={() => setEditingPlanned(null)} categories={categories.filter((c: any) => c.kind === "expense")} />}
      {editingRecurring && <RecurringDialog item={editingRecurring} onClose={() => setEditingRecurring(null)} categories={categories} />}
      {recurringDay && <RecurringDialog initialDay={recurringDay} onClose={() => setRecurringDay(null)} categories={categories} />}
      <BtnStyles />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 truncate text-base font-bold sm:text-xl">{value}</div>
    </div>
  );
}
