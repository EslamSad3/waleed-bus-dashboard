import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { BackButton } from "@/components/shell/back-button";
import { NotificationRealtime } from "@/components/notifications/notification-realtime";
import { t } from "@/lib/i18n/t";

/**
 * Authoritative shell guard (Principle I, second layer).
 * Requires appRole === 'super_admin' from GET /auth/me on EVERY shell render.
 */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || session.appRole !== "super_admin") {
    redirect("/login");
  }

  return (
    <div className="page-bg min-h-screen">
      <NotificationRealtime userId={session.id} />
      <Topbar email={session.email} userId={session.id} />
      <div className="mx-auto flex max-w-[1480px] gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
        {/* Desktop sidebar; on phones the drawer in the topbar takes over */}
        <Sidebar />
        <main className="min-w-0 flex-1">
          <BackButton />
          {children}
        </main>
      </div>
      <footer className="border-t border-slate-200/70 px-3 py-5 text-center text-xs text-[#5e6b78] sm:px-6 lg:px-8">
        {t("common.app.documentTitle")}
      </footer>
    </div>
  );
}
