import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { budgetsQuery, categoriesQuery, transactionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, EmptyState, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — Finlo" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(budgetsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(transactionsQuery),
    ]),
  component: BudgetsPage,
});

function BudgetsPage() {
  const [{ data: budgets }, { data: categories }, { data: tx }] = useSuspenseQueries({
    queries: [budgetsQuery, categoriesQuery, transactionsQuery],
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ms = startOfMonth(new Date()), me = endOfMonth(new Date());
  const monthTx = tx.filter((t) => t.type === "expense" && new Date(t.occurred_on) >= ms && new Date(t.occurred_on) <= me);

  const remove = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["budgets"] }); }
  };

  return (
    <>
      <PageHeader title="Budgets" subtitle="Monthly spending targets per category" action={
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New budget</button>
      } />
      {budgets.length === 0 ? (
        <EmptyState text="Set a budget for your top categories." onAction={() => setOpen(true)} />
      ) : (
        <div className="grid gap-3">
          {budgets.map((b: any) => {
            const spent = monthTx.filter((t) => t.category_id === b.category_id).reduce((s, t) => s + Number(t.amount), 0);
            const pct = Math.min(100, (spent / Number(b.amount)) * 100);
            const over = spent > Number(b.amount);
            const remaining = Number(b.amount) - spent;
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: b.categories?.color }} />
                    <span className="font-semibold">{b.categories?.name}</span>
                  </div>
                  <button onClick={() => remove(b.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="num flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{formatNGN(spent)}</span>
                  <span className="text-sm text-muted-foreground">of {formatNGN(b.amount)}</span>
                </div>
                <div className="h-2 mt-3 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full transition-all" style={{ width: pct + "%", background: over ? "var(--destructive)" : b.categories?.color ?? "var(--primary)" }} />
                </div>
                <div className={`text-xs mt-2 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                  {over ? `Over by ${formatNGN(-remaining)}` : `${formatNGN(remaining)} remaining`}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <BudgetDialog onClose={() => setOpen(false)} categories={categories.filter((c: any) => c.kind === "expense")} existing={budgets} />}
      <BtnStyles />
    </>
  );
}

function BudgetDialog({ onClose, categories, existing }: { onClose: () => void; categories: any[]; existing: any[] }) {
  const qc = useQueryClient();
  const taken = new Set(existing.map((b: any) => b.category_id));
  const available = categories.filter((c) => !taken.has(c.id));
  const [category_id, setCat] = useState(available[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("budgets").insert({ user_id: user.id, category_id, amount: Number(amount), period: "monthly" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Budget set"); qc.invalidateQueries({ queryKey: ["budgets"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title="New budget">
      <form onSubmit={save} className="space-y-3">
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">All expense categories already have a budget.</p>
        ) : (
          <>
            <Field label="Category">
              <select required value={category_id} onChange={(e) => setCat(e.target.value)} className="finlo-input">
                {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Monthly limit (₦)"><input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="finlo-input" /></Field>
            <ModalActions onClose={onClose} saving={saving} />
          </>
        )}
      </form>
    </Modal>
  );
}
