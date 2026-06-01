import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { plannedQuery, categoriesQuery, recurringQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, EmptyState, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, Repeat, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planned")({
  head: () => ({ meta: [{ title: "Planned & Recurring | Pocketstead" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(plannedQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(recurringQuery),
    ]),
  component: PlannedPage,
});

function PlannedPage() {
  const [{ data: planned }, { data: categories }, { data: recurring }] = useSuspenseQueries({
    queries: [plannedQuery, categoriesQuery, recurringQuery],
  });
  const qc = useQueryClient();
  const [tab, setTab] = useState<"planned" | "recurring">("planned");
  const [openP, setOpenP] = useState(false);
  const [openR, setOpenR] = useState(false);

  const togglePlanned = async (id: string, completed: boolean) => {
    await supabase.from("planned_expenses").update({ completed: !completed }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["planned"] });
  };
  const deletePlanned = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("planned_expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["planned"] });
  };
  const deleteRecurring = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("recurring_bills").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recurring"] });
  };

  return (
    <>
      <PageHeader title="Planned & Recurring" subtitle="Future purchases and monthly bills" action={
        <button onClick={() => tab === "planned" ? setOpenP(true) : setOpenR(true)} className="btn-primary"><Plus className="h-4 w-4" /> {tab === "planned" ? "New planned" : "New recurring"}</button>
      } />
      <div className="flex gap-2 mb-4">
        <Tab active={tab === "planned"} onClick={() => setTab("planned")} icon={CalendarClock}>Planned ({planned.length})</Tab>
        <Tab active={tab === "recurring"} onClick={() => setTab("recurring")} icon={Repeat}>Recurring ({recurring.length})</Tab>
      </div>

      {tab === "planned" ? (
        planned.length === 0 ? <EmptyState text="No planned expenses yet." onAction={() => setOpenP(true)} /> : (
          <ul className="space-y-2">
            {planned.map((p: any) => (
              <li key={p.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-xl border border-border bg-surface p-3 sm:flex sm:gap-3 sm:p-4 ${p.completed ? "opacity-60" : ""}`}>
                <button onClick={() => togglePlanned(p.id, p.completed)} className={`grid h-6 w-6 place-items-center rounded-md border ${p.completed ? "bg-success border-success text-white" : "border-border"}`}>
                  {p.completed && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium sm:text-base ${p.completed ? "line-through" : ""}`}>{p.name}</div>
                  <div className="text-xs text-muted-foreground">Due {formatDate(p.due_date)} {p.categories?.name && `· ${p.categories.name}`}</div>
                </div>
                <div className="num text-sm font-semibold sm:text-base">{formatNGN(p.amount)}</div>
                <button onClick={() => deletePlanned(p.id)} className="col-start-3 text-right text-muted-foreground hover:text-destructive"><Trash2 className="ml-auto h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )
      ) : (
        recurring.length === 0 ? <EmptyState text="No recurring bills or salaries yet." onAction={() => setOpenR(true)} /> : (
          <ul className="space-y-2">
            {recurring.map((r: any) => (
              <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-xl border border-border bg-surface p-3 sm:flex sm:gap-3 sm:p-4">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${r.kind === "salary" ? "bg-success/15 text-success" : "bg-primary-soft text-primary"}`}>
                  <Repeat className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium sm:text-base">{r.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">Day {r.day_of_month} · {r.kind}</div>
                </div>
                <div className={`num text-sm font-semibold sm:text-base ${r.kind === "salary" ? "text-success" : ""}`}>{r.kind === "salary" ? "+" : "-"}{formatNGN(r.amount)}</div>
                <button onClick={() => deleteRecurring(r.id)} className="col-start-3 text-right text-muted-foreground hover:text-destructive"><Trash2 className="ml-auto h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )
      )}
      {openP && <PlannedDialog onClose={() => setOpenP(false)} categories={categories.filter((c: any) => c.kind === "expense")} />}
      {openR && <RecurringDialog onClose={() => setOpenR(false)} categories={categories} />}
      <BtnStyles />
    </>
  );
}

function Tab({ active, onClick, icon: Icon, children }: any) {
  return <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:gap-2 sm:px-4 sm:text-sm ${active ? "bg-foreground text-background" : "bg-surface border border-border text-muted-foreground"}`}><Icon className="h-4 w-4" />{children}</button>;
}

function PlannedDialog({ onClose, categories }: { onClose: () => void; categories: any[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due_date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category_id, setCat] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("planned_expenses").insert({
      user_id: user.id, name, amount: Number(amount), due_date, category_id: category_id || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["planned"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title="New planned expense">
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
        <Field label="Amount (₦)"><input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="finlo-input" /></Field>
        <Field label="Due date"><input required type="date" value={due_date} onChange={(e) => setDate(e.target.value)} className="finlo-input" /></Field>
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

function RecurringDialog({ onClose, categories }: { onClose: () => void; categories: any[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day_of_month, setDay] = useState("1");
  const [kind, setKind] = useState<"bill" | "salary" | "subscription">("bill");
  const [category_id, setCat] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = categories.filter((c) => kind === "salary" ? c.kind === "income" : c.kind === "expense");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("recurring_bills").insert({
      user_id: user.id, name, amount: Number(amount), day_of_month: Number(day_of_month), kind, category_id: category_id || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Added"); qc.invalidateQueries({ queryKey: ["recurring"] }); onClose(); }
  };

  return (
    <Modal onClose={onClose} title="New recurring item">
      <form onSubmit={save} className="space-y-3">
        <Field label="Type">
          <select value={kind} onChange={(e) => { setKind(e.target.value as any); setCat(""); }} className="finlo-input">
            <option value="bill">Bill</option><option value="subscription">Subscription</option><option value="salary">Salary / Income</option>
          </select>
        </Field>
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)"><input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="finlo-input" /></Field>
          <Field label="Day of month"><input required type="number" min={1} max={31} value={day_of_month} onChange={(e) => setDay(e.target.value)} className="finlo-input" /></Field>
        </div>
        <Field label="Category">
          <select value={category_id} onChange={(e) => setCat(e.target.value)} className="finlo-input">
            <option value="">None</option>
            {filtered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}
