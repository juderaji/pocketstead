import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Wallet, ArrowLeftRight, PieChart, Calendar, ShoppingCart, ListChecks, Settings, LogOut, PiggyBank, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PocketsteadLogo } from "@/components/PocketsteadLogo";
import { useState } from "react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/budgets", label: "Budgets", icon: PieChart },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/planned", label: "Planned", icon: ListChecks },
  { to: "/shopping", label: "Shopping", icon: ShoppingCart },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const loc = useLocation();
  const router = useRouter();
  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <PocketsteadLogo />
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((it) => {
          const active = loc.pathname === it.to || (it.to !== "/app" && loc.pathname.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground font-medium shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const loc = useLocation();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = navItems.slice(0, 4);
  const moreItems = navItems.slice(4);
  const moreActive = moreItems.some((it) => loc.pathname === it.to || loc.pathname.startsWith(it.to));
  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };
  return (
    <>
      {moreOpen && (
        <>
          <button className="fixed inset-0 z-30 bg-foreground/30 md:hidden" aria-label="Close navigation menu" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-border bg-sidebar p-3 shadow-lift md:hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More</span>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-sidebar-accent" aria-label="Close menu"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {moreItems.map((it) => {
                const active = loc.pathname === it.to || loc.pathname.startsWith(it.to);
                return (
                  <Link key={it.to} to={it.to} onClick={() => setMoreOpen(false)} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                    <it.icon className="h-4 w-4" /> {it.label}
                  </Link>
                );
              })}
            </div>
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg border-t border-sidebar-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {primaryItems.map((it) => {
        const active = loc.pathname === it.to || (it.to !== "/app" && loc.pathname.startsWith(it.to));
        return (
          <Link key={it.to} to={it.to} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
            <it.icon className="h-4.5 w-4.5" />
            {it.label}
          </Link>
        );
      })}
      <button onClick={() => setMoreOpen((open) => !open)} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] ${moreOpen || moreActive ? "text-primary" : "text-muted-foreground"}`}>
        <Menu className="h-4.5 w-4.5" /> More
      </button>
      </nav>
    </>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{subtitle}</p>}
      </div>
      {action && <div className="w-full [&_.btn-primary]:w-full [&_.btn-primary]:justify-center sm:w-auto sm:[&_.btn-primary]:w-auto">{action}</div>}
    </div>
  );
}
