import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { accountsQuery, savingsGoalsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, EmptyState, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/savings")({
  head: () => ({ meta: [{ title: "Savings goals | Pocketstead" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(savingsGoalsQuery),
    ]),
  component: SavingsPage,
});

function SavingsPage() {
  const [{ data: accounts }, { data: goals }] = useSuspenseQueries({ queries: [accountsQuery, savingsGoalsQuery] });
  const qc = useQueryClient();
  const savingsAccounts = accounts.filter((account) => account.type === "savings");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [adjusting, setAdjusting] = useState<{ goal: any; mode: "add" | "withdraw" } | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Delete this savings goal? Reserved money will become unallocated.")) return;
    const { error } = await supabase.from("savings_goals").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Goal deleted"); qc.invalidateQueries({ queryKey: ["savings-goals"] }); }
  };

  return (
    <>
      <PageHeader title="Savings goals" subtitle="Set aside money inside your savings accounts" action={
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New goal</button>
      } />
      {savingsAccounts.length === 0 ? (
        <EmptyState text="Change an account type to Savings before creating a goal." />
      ) : goals.length === 0 ? (
        <EmptyState text="Create a goal for rent, emergency savings, or anything else you are setting money aside for." onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-6">
          {savingsAccounts.map((account) => {
            const accountGoals = goals.filter((goal) => goal.account_id === account.id);
            const allocated = accountGoals.reduce((sum, goal) => sum + Number(goal.saved_amount), 0);
            const unallocated = Number(account.balance) - allocated;
            return (
              <section key={account.id} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
                  <div>
                    <h2 className="font-semibold">{account.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">Savings account balance: {formatNGN(account.balance)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Unallocated</div>
                    <div className="num text-xl font-bold">{formatNGN(unallocated)}</div>
                  </div>
                </div>
                {accountGoals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-5">No goals in this account yet.</p>
                ) : (
                  <div className="grid gap-3 pt-4 sm:grid-cols-2">
                    {accountGoals.map((goal) => {
                      const target = Number(goal.target_amount || 0);
                      const saved = Number(goal.saved_amount);
                      const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
                      return (
                        <div key={goal.id} className="rounded-xl border border-border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ background: goal.color }} />
                              <span className="font-semibold">{goal.name}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditing(goal)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${goal.name}`}><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => remove(goal.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${goal.name}`}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                          <div className="num mt-4 text-2xl font-bold">{formatNGN(saved)}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {target > 0 ? `of ${formatNGN(target)}` : "No target set"}
                            {goal.due_date ? ` · due ${formatDate(goal.due_date)}` : ""}
                          </div>
                          {target > 0 && <div className="h-2 mt-3 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full" style={{ width: pct + "%", background: goal.color }} />
                          </div>}
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => setAdjusting({ goal, mode: "add" })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add</button>
                            <button onClick={() => setAdjusting({ goal, mode: "withdraw" })} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 hover:bg-secondary"><Minus className="h-3 w-3" /> Withdraw</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {open && <GoalDialog accounts={savingsAccounts} onClose={() => setOpen(false)} />}
      {editing && <GoalDialog accounts={savingsAccounts} goal={editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustGoalDialog {...adjusting} onClose={() => setAdjusting(null)} />}
      <BtnStyles />
    </>
  );
}

function GoalDialog({ accounts, goal, onClose }: { accounts: any[]; goal?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(goal?.name ?? "");
  const [account_id, setAccount] = useState(goal?.account_id ?? accounts[0]?.id ?? "");
  const [target, setTarget] = useState(goal?.target_amount ? String(goal.target_amount) : "");
  const [due_date, setDueDate] = useState(goal?.due_date ?? "");
  const [color, setColor] = useState(goal?.color ?? "#3b82f6");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const values = { name, account_id, target_amount: target ? Number(target) : null, due_date: due_date || null, color };
    let error;
    if (goal) ({ error } = await supabase.from("savings_goals").update(values).eq("id", goal.id));
    else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      ({ error } = await supabase.from("savings_goals").insert({ user_id: user.id, ...values }));
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(goal ? "Goal updated" : "Goal created"); qc.invalidateQueries({ queryKey: ["savings-goals"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title={goal ? "Edit savings goal" : "New savings goal"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" placeholder="e.g. Rent" /></Field>
        <Field label="Savings account"><select required disabled={Boolean(goal?.saved_amount)} value={account_id} onChange={(e) => setAccount(e.target.value)} className="finlo-input">
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select></Field>
        <Field label="Target amount (optional)"><input type="number" min="0" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} className="finlo-input" /></Field>
        <Field label="Due date (optional)"><input type="date" value={due_date} onChange={(e) => setDueDate(e.target.value)} className="finlo-input" /></Field>
        <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-border bg-surface p-1" /></Field>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

function AdjustGoalDialog({ goal, mode, onClose }: { goal: any; mode: "add" | "withdraw"; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const value = Number(amount) * (mode === "add" ? 1 : -1);
    const { error } = await supabase.rpc("adjust_savings_goal", { p_goal_id: goal.id, p_amount: value });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(mode === "add" ? "Money allocated" : "Money released"); qc.invalidateQueries({ queryKey: ["savings-goals"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title={`${mode === "add" ? "Add to" : "Withdraw from"} ${goal.name}`}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-muted-foreground">{mode === "add" ? "Reserve part of this savings account balance for the goal." : "Release reserved money back to the account's unallocated balance."}</p>
        <Field label="Amount"><input required autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="finlo-input" /></Field>
        <ModalActions onClose={onClose} saving={saving} label={mode === "add" ? "Allocate" : "Withdraw"} />
      </form>
    </Modal>
  );
}
