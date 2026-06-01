import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { transactionsQuery, accountsQuery, categoriesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, EmptyState, BtnStyles } from "./accounts";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Finlo" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(transactionsQuery),
      context.queryClient.ensureQueryData(accountsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]),
  component: TxPage,
});

function TxPage() {
  const [{ data: tx }, { data: accounts }, { data: categories }] = useSuspenseQueries({
    queries: [transactionsQuery, accountsQuery, categoriesQuery],
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const filtered = useMemo(() => filter === "all" ? tx : tx.filter((t) => t.type === filter), [tx, filter]);

  const remove = async (id: string) => {
    const t = tx.find((x) => x.id === id);
    if (!t) return;
    if (!confirm("Delete this transaction?")) return;
    // adjust account balance
    if (t.account_id) {
      const acc = accounts.find((a) => a.id === t.account_id);
      if (acc) {
        const delta = t.type === "income" ? -Number(t.amount) : Number(t.amount);
        await supabase.from("accounts").update({ balance: Number(acc.balance) + delta }).eq("id", acc.id);
      }
    }
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries(); }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={`${tx.length} entries`}
        action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>}
      />

      <div className="flex gap-2 mb-4">
        {(["all", "income", "expense"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-foreground text-background" : "bg-surface border border-border text-muted-foreground hover:bg-secondary"}`}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="No transactions yet." onAction={() => setOpen(true)} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <ul className="divide-y divide-border">
            {filtered.map((t: any) => (
              <li key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-secondary/40">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${t.type === "income" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {t.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.description || t.categories?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    <span>{formatDate(t.occurred_on)}</span>
                    {t.accounts?.name && <span>· {t.accounts.name}</span>}
                    {t.categories?.name && <span>· {t.categories.name}</span>}
                  </div>
                </div>
                <div className={`num font-semibold ${t.type === "income" ? "text-success" : ""}`}>{t.type === "income" ? "+" : "-"}{formatNGN(t.amount)}</div>
                <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && <TxDialog onClose={() => setOpen(false)} accounts={accounts} categories={categories} />}
      <BtnStyles />
    </>
  );
}

function TxDialog({ onClose, accounts, categories }: { onClose: () => void; accounts: any[]; categories: any[] }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [account_id, setAccount] = useState(accounts[0]?.id ?? "");
  const [category_id, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [occurred_on, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const filteredCats = categories.filter((c) => c.kind === type);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account_id) return toast.error("Add an account first");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const amt = Number(amount);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, account_id, category_id: category_id || null, amount: amt, type, description, occurred_on,
    });
    if (!error && account_id) {
      const acc = accounts.find((a) => a.id === account_id);
      if (acc) {
        const delta = type === "income" ? amt : -amt;
        await supabase.from("accounts").update({ balance: Number(acc.balance) + delta }).eq("id", account_id);
      }
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); qc.invalidateQueries(); onClose(); }
  };

  return (
    <Modal onClose={onClose} title="New transaction">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["expense", "income"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setType(t); setCategory(""); }} className={`rounded-lg border px-3 py-2 text-sm capitalize font-medium ${type === t ? "bg-primary text-primary-foreground border-primary" : "border-border bg-surface"}`}>{t}</button>
          ))}
        </div>
        <Field label="Amount (₦)"><input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="finlo-input" /></Field>
        <Field label="Account">
          <select required value={account_id} onChange={(e) => setAccount(e.target.value)} className="finlo-input">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={category_id} onChange={(e) => setCategory(e.target.value)} className="finlo-input">
            <option value="">None</option>
            {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className="finlo-input" placeholder="optional" /></Field>
        <Field label="Date"><input type="date" value={occurred_on} onChange={(e) => setDate(e.target.value)} className="finlo-input" /></Field>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}
