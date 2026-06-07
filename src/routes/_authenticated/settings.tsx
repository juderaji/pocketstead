import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { categoriesQuery, profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppSidebar";
import { Modal, Field, ModalActions, BtnStyles } from "./accounts";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarOptions } from "@/lib/avatar-options";

type CategoryKind = "expense" | "income";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings | Pocketstead" }] }),
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
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", profile.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
  };

  const saveAvatar = async (url: string) => {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      setAvatarUrl(url);
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Profile image must be 3 MB or smaller");
      return;
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("profile-avatars").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
    await saveAvatar(data.publicUrl);
    setUploading(false);
  };

  const removeCat = async (id: string) => {
    if (!confirm("Delete this category? Its transactions will move to Other.")) return;
    const { error } = await supabase.rpc("delete_category", { p_category_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries(); }
  };

  const isDefaultCategory = (category: any) => category.name?.trim().toLowerCase() === "other";

  const categoryGroups = [
    {
      key: "expense",
      title: "Expense categories",
      description: "Used for transactions, budgets, planned spending, and recurring bills.",
      items: categories.filter((c: any) => c.kind === "expense"),
    },
    {
      key: "income",
      title: "Income categories",
      description: "Used for salary, transfers in, repayments, and other money coming in.",
      items: categories.filter((c: any) => c.kind === "income"),
    },
  ];
  const otherCategories = categories.filter((c: any) => !["expense", "income"].includes(c.kind));
  if (otherCategories.length) {
    categoryGroups.push({
      key: "other",
      title: "Other categories",
      description: "Categories with a custom type.",
      items: otherCategories,
    });
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4 sm:space-y-6">
        <section className="rounded-xl border border-border bg-surface p-3 shadow-soft sm:rounded-2xl sm:p-5">
          <h2 className="font-semibold mb-3">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} className="finlo-input" /></Field>
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary justify-center">{savingProfile ? "Saving..." : "Save"}</button>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 border border-border">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs font-bold text-primary">{(name || "PS").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Profile picture</h3>
                  <p className="truncate text-xs text-muted-foreground">Pick an avatar or upload your own image.</p>
                </div>
              </div>
              <label className="btn-primary cursor-pointer justify-center">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => uploadAvatar(event.target.files?.[0])} className="sr-only" />
              </label>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {avatarOptions.map((url) => (
                <button key={url} type="button" onClick={() => saveAvatar(url)} aria-label="Choose profile avatar" className={`relative rounded-full transition-transform hover:scale-105 ${avatarUrl === url ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                  <Avatar className="h-full w-full border border-border"><AvatarImage src={url} alt="" /></Avatar>
                  {avatarUrl === url && <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Currency: <strong>NGN (₦)</strong></p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-3 shadow-soft sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Categories</h2>
              <p className="mt-1 text-xs text-muted-foreground">Grouped by how they behave across the app.</p>
            </div>
            <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {categoryGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-border/80 bg-background/60 p-3 sm:p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold sm:text-base">{group.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {group.items.length}
                  </span>
                </div>
                {group.items.length ? (
                  <ul className="space-y-1.5">
                    {group.items.map((c: any) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-secondary/50 sm:gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="flex-1 truncate text-sm font-medium sm:text-base">{c.name}</span>
                        {isDefaultCategory(c) ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Default
                          </span>
                        ) : (
                          <>
                            <button onClick={() => setEditing(c)} className="text-muted-foreground hover:text-primary" aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => removeCat(c.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No {group.key} categories yet.
                  </div>
                )}
              </div>
            ))}
          </div>
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
  const initialKind: CategoryKind = category?.kind === "income" ? "income" : "expense";
  const [kind, setKind] = useState<CategoryKind>(initialKind);
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
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Type</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CategoryTypeOption
              active={kind === "expense"}
              description="Spending, bills, budgets, and planned expenses"
              title="Expense"
              onClick={() => setKind("expense")}
            />
            <CategoryTypeOption
              active={kind === "income"}
              description="Salary, repayments, gifts, and money coming in"
              title="Income"
              onClick={() => setKind("income")}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="finlo-input h-10" /></Field>
        </div>
        <ModalActions onClose={onClose} saving={saving} />
      </form>
    </Modal>
  );
}

function CategoryTypeOption({ active, description, onClick, title }: { active: boolean; description: string; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-primary bg-primary-soft text-foreground shadow-soft"
          : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`grid h-4 w-4 place-items-center rounded-full border ${active ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
          {active && <Check className="h-3 w-3 text-primary-foreground" />}
        </span>
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
