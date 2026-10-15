import { Suspense } from "react";
import { redirect } from "next/navigation";
import { can, isDashboardRole, readSession } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { BackButton } from "@/components/shell/back-button";
import { NotificationRealtime } from "@/components/notifications/notification-realtime";
import { t } from "@/lib/i18n/t";

/**
 * Authoritative shell guard (Principle I, second layer).
 * Admits dashboard roles from the JWT after live session validation.
 */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || !isDashboardRole(session.appRole)) {
    redirect("/login");
  }

  const access = { appRole: session.appRole, permissions: session.permissions };

  return (
    <div className="page-bg min-h-screen">
      {can(session, "notifications.read") ? <NotificationRealtime userId={session.id} /> : null}
      <Topbar email={session.email} userId={session.id} access={access} />
      <div className="mx-auto flex max-w-[1480px] gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
        {/* Desktop sidebar; on phones the drawer in the topbar takes over */}
        <Sidebar access={access} />
        <main className="min-w-0 flex-1">
          <BackButton />
          {/* Every detail page unwraps `use(params)` / `use(searchParams)` and
              several lists read `useSearchParams()` — all of those suspend
              during prerender. Without an explicit boundary the server cannot
              finish the Suspense boundary and the browser falls back to
              client rendering ("switched to client rendering" in the console).
              This single boundary lets the server stream the fallback instead. */}
          <Suspense
            fallback={
              <div className="dashboard-page" aria-busy="true">
                <div className="page-heading">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-9 w-2/3 max-w-xs animate-pulse rounded-xl bg-[#e3ecf3]" />
                    <div className="h-4 w-full max-w-md animate-pulse rounded-lg bg-[#e3ecf3]" />
                  </div>
                </div>
                <div className="h-40 animate-pulse rounded-2xl bg-[#e3ecf3]" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
      <footer className="border-t border-slate-200/70 px-3 py-5 text-center text-xs text-[#5e6b78] sm:px-6 lg:px-8">
        {t("common.app.documentTitle")}
      </footer>
    </div>
  );
}
