import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileNav } from "@/components/AppSidebar";
import { ProfileMenu } from "@/components/ProfileMenu";
import { PocketsteadLogo } from "@/components/PocketsteadLogo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw redirect({ to: "/login", replace: true });
    }
  },
  pendingComponent: AuthLoading,
  component: AuthLayout,
});

function AuthLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <p className="text-sm text-muted-foreground">Loading Pocketstead...</p>
    </div>
  );
}

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen gap-3 bg-surface md:h-screen md:overflow-hidden md:p-3">
        <AppSidebar />
        <main className="min-w-0 flex-1 bg-surface pb-20 md:h-screen md:overflow-y-auto md:pb-0">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-7 md:py-8 lg:px-9">
            <div className="mb-4 flex items-center justify-between md:hidden">
              <Link to="/" aria-label="Pocketstead home" className="font-display text-sm font-bold text-primary">
                <PocketsteadLogo />
              </Link>
              <ProfileMenu showName={false} />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
