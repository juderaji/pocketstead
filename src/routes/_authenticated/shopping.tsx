import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { shoppingQuery, categoriesQuery, accountsQuery, recurringQuery, plannedQuery, transactionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, EmptyState, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, ShoppingBag } from "lucide-react";
import { computeForecast, canAfford } from "@/lib/forecast";

export const Route = createFileRoute("/_authenticated/shopping")({
  head: () => ({ meta: [{ title: "Shopping — Finlo" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(shoppingQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(recurringQuery),
      context.queryClient.ensureQueryData(plannedQuery),
      context.queryClient.ensureQueryData(transactionsQuery),
    ]),
  component: ShoppingPage,
});

const priorityLabel: Record<number, string> = { 1: "High", 2: "Med-High", 3: "Medium", 4: "Med-Low", 5: "Low" };
const priorityColor: Record<number, string> = { 1: "var(--destructive)", 2: "var(--warning)", 3: "var(--primary)", 4: "var(--muted-foreground)", 5: "var(--muted-foreground)" };

function ShoppingPage() {
  const [{ data: items }, { data: categories }, { data: accounts }, { data: recurring }, { data: planned }, { data: tx }] = useSuspenseQueries({
    queries: [shoppingQuery, categoriesQuery, accountsQuery, recurringQuery, plannedQuery, transactionsQuery],
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const forecast = computeForecast({
    accountsBalance: totalBalance,
    transactions: tx.map((t) => ({ amount: Number(t.amount), type: t.type as any, occurred_on: t.occurred_on })),
    recurring: recurring.map((r) => ({ amount: Number(r.amount), day_of_month: r.day_of_month, kind: r.kind as any })),
    planned: planned.map((p) => ({ amount: Number(p.amount), due_date: p.due_date, completed: p.completed })),
  });

  const totalCost = items.filter((i) => !i.purchased).reduce((s, i) => s + Number(i.estimated_cost), 0);

  const toggle = async (id: string, p: boolean) => {
    await supabase.from("shopping_items").update({ purchased: !p }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["shopping"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("shopping_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["shopping"] });
  };

  return (
    <>
      <PageHeader title="Shopping list" subtitle={`${formatNGN(totalCost)} pending across ${items.filter((i) => !i.purchased).length} items`} action={
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add item</button>
      } />

      {items.length === 0 ? <EmptyState text="What do you want to buy next?" onAction={() => setOpen(true)} /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i: any) => {
            const afford = canAfford(Number(i.estimated_cost), forecast);
            return (
              <li key={i.id} className={`rounded-2xl border border-border bg-surface p-5 shadow-soft ${i.purchased ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between">
                  <button onClick={() => toggle(i.id, i.purchased)} className={`grid h-6 w-6 place-items-center rounded-md border ${i.purchased ? "bg-success border-success text-white" : "border-border"}`}>
                    {i.purchased && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className={`mt-3 font-semibold ${i.purchased ? "line-through" : ""}`}>{i.name}</div>
                <div className="num text-xl font-bold mt-1">{formatNGN(i.estimated_cost)}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Pill color={priorityColor[i.priority]}>{priorityLabel[i.priority]}</Pill>
                  {i.planned_date && <Pill>{formatDate(i.planned_date)}</Pill>}
                  {i.categories?.name && <Pill color={i.categories.color}>{i.categories.name}</Pill>}
                  {!i.purchased && <AffordBadge a={afford} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {open && <ShoppingDialog onClose={() => setOpen(false)} categories={categories.filter((c: any) => c.kind === "expense")} />}
      <BtnStyles />
    </>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: (color ?? "var(--muted-foreground)") + "1f", color: color ?? "var(--muted-foreground)" }}>
    {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}{children}
  </span>;
}

function AffordBadge({ a }: { a: "yes" | "tight" | "no" }) {
  const map = { yes: { l: "Affordable", c: "var(--success)" }, tight: { l: "Tight", c: "var(--warning)" }, no: { l: "Not yet", c: "var(--destructive)" } } as const;
  const v = map[a];
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: v.c + "1f", color: v.c }}>
    <ShoppingBag className="h-3 w-3" /> {v.l}
  </span>;
}

function ShoppingDialog({ onClose, categories }: { onClose: () => void; categories: any[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [estimated_cost, setCost] = useState("");
  const [priority, setPriority] = useState("3");
  const [planned_date, setDate] = useState("");
  const [category_id, setCat] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("shopping_items").insert({
      user_id: user.id, name, estimated_cost: Number(estimated_cost), priority: Number(priority),
      planned_date: planned_date || null, category_id: category_id || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["shopping"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title="New shopping item">
      <form onSubmit={save} className="space-y-3">
        <Field label="Item"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated cost (₦)"><input required type="number" step="0.01" value={estimated_cost} onChange={(e) => setCost(e.target.value)} className="finlo-input" /></Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="finlo-input">
              <option value="1">High</option><option value="2">Med-High</option><option value="3">Medium</option><option value="4">Med-Low</option><option value="5">Low</option>
            </select>
          </Field>
        </div>
        <Field label="Planned date"><input type="date" value={planned_date} onChange={(e) => setDate(e.target.value)} className="finlo-input" /></Field>
        <Field label="Category">
          <select value={category_id} onChange={(e) => setCat(e.target.value)} className="finlo-input">
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}
