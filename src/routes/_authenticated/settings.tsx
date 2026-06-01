import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { categoriesQuery, profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Finlo" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(profileQuery),
    ]),
  component: SettingsPage,
});

function SettingsPage() {
  const [{ data: categories }, { data: profile }] = useSuspenseQueries({ queries: [categoriesQuery, profileQuery] });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState(profile.display_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", profile.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  };

  const removeCat = async (id: string) => {
    if (!confirm("Delete this category? Its transactions will move to Other.")) return;
    const { error } = await supabase.rpc("delete_category", { p_category_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries(); }
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <h2 className="font-semibold mb-3">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary justify-center">{savingProfile ? "Saving..." : "Save"}</button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Currency: <strong>NGN (₦)</strong></p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Categories</h2>
            <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
          </div>
          <ul className="space-y-1.5">
            {categories.map((c: any) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="text-xs uppercase text-muted-foreground">{c.kind}</span>
                <button onClick={() => setEditing(c)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => removeCat(c.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {open && <CategoryDialog onClose={() => setOpen(false)} />}
      {editing && <CategoryDialog category={editing} onClose={() => setEditing(null)} />}
      <BtnStyles />
    </>
  );
}

function CategoryDialog({ onClose, category }: { onClose: () => void; category?: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<"income" | "expense">(category?.kind ?? "expense");
  const [color, setColor] = useState(category?.color ?? "#3b82f6");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = category
      ? await supabase.from("categories").update({ name, kind, color }).eq("id", category.id)
      : await supabase.from("categories").insert({ user_id: user.id, name, kind, color });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(category ? "Updated" : "Added"); qc.invalidateQueries(); onClose(); }
  };

  return (
    <Modal onClose={onClose} title={category ? "Edit category" : "New category"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input required value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="finlo-input">
              <option value="expense">Expense</option><option value="income">Income</option>
            </select>
          </Field>
          <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="finlo-input h-10" /></Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}
