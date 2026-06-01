import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { accountsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, Building2, CreditCard, PiggyBank, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts | Pocketstead" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountsQuery),
  component: AccountsPage,
});

const typeIcons: Record<string, any> = { cash: Wallet, bank: Building2, card: CreditCard, savings: PiggyBank };

function AccountsPage() {
  const { data: accounts } = useSuspenseQuery(accountsQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(typeof accounts)[number] | null>(null);
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const remove = async (id: string) => {
    if (!confirm("Archive this account?")) return;
    const { error } = await supabase.from("accounts").update({ archived: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Archived"); qc.invalidateQueries({ queryKey: ["accounts"] }); }
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle={`${formatNGN(total)} across ${accounts.length} accounts`}
        action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> New account</button>}
      />
      {accounts.length === 0 ? (
        <EmptyState text="Add your first account to start tracking." onAction={() => setOpen(true)} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {accounts.map((a) => {
            const Icon = typeIcons[a.type] ?? Wallet;
            return (
              <div key={a.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft sm:relative sm:block sm:rounded-2xl sm:p-5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg sm:h-10 sm:w-10" style={{ background: a.color + "20", color: a.color }}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 sm:mt-4">
                    <div className="text-[11px] capitalize leading-none text-muted-foreground sm:text-sm">{a.type}</div>
                    <div className="mt-1 truncate text-sm font-semibold sm:text-base">{a.name}</div>
                    <div className="num mt-1 truncate text-lg font-bold sm:mt-2 sm:text-2xl">{formatNGN(a.balance)}</div>
                  </div>
                  <div className="flex gap-3 self-start sm:absolute sm:right-5 sm:top-5 sm:gap-2">
                    <button onClick={() => setEditing(a)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${a.name}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Archive ${a.name}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <AccountDialog onClose={() => setOpen(false)} />}
      {editing && <AccountDialog account={editing} onClose={() => setEditing(null)} />}
      <BtnStyles />
    </>
  );
}

function AccountDialog({ onClose, account }: { onClose: () => void; account?: { id: string; name: string; type: string; color: string } }) {
  const qc = useQueryClient();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "cash");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState(account?.color ?? "#3b82f6");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = account
      ? await supabase.from("accounts").update({ name, type, color }).eq("id", account.id)
      : await supabase.from("accounts").insert({ user_id: user.id, name, type, balance: Number(balance), color });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(account ? "Account updated" : "Account added"); qc.invalidateQueries({ queryKey: ["accounts"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title={account ? "Edit account" : "New account"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" placeholder="e.g. GTBank Savings" /></Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="finlo-input">
            <option value="cash">Cash</option><option value="bank">Bank</option><option value="card">Card</option><option value="savings">Savings</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {!account && <Field label="Starting balance"><input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className="finlo-input" /></Field>}
          <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="finlo-input h-10" /></Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-foreground/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-lift sm:max-w-md sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
export function ModalActions({ onClose, saving, label = "Save" }: { onClose: () => void; saving: boolean; label?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
      <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-secondary sm:py-2">Cancel</button>
      <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:py-2">
        {saving ? "Saving..." : label}
      </button>
    </div>
  );
}

export function EmptyState({ text, onAction }: { text: string; onAction?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:rounded-2xl sm:p-12">
      <p className="text-muted-foreground">{text}</p>
      {onAction && <button onClick={onAction} className="btn-primary mt-4 mx-auto"><Plus className="h-4 w-4" /> Add now</button>}
    </div>
  );
}

export function BtnStyles() {
  return <style>{`
    .btn-primary{display:inline-flex;align-items:center;gap:.5rem;border-radius:.5rem;background:var(--primary);color:var(--primary-foreground);padding:.5rem .875rem;font-size:.8125rem;font-weight:500}
    .btn-primary:hover{opacity:.9}
    .finlo-input{width:100%;border:1px solid var(--border);background:var(--surface);border-radius:.5rem;padding:.55rem .75rem;font-size:.9rem;outline:none}
    .finlo-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
    @media (min-width:640px){.btn-primary{padding:.5rem 1rem;font-size:.875rem}}
  `}</style>;
}
