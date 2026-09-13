import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

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
      <Topbar email={session.email} />
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="md:hidden">
          <Sidebar />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="border-t border-slate-200/70 px-4 py-5 text-center text-xs text-[#5e6b78]">
        منصة الأتوبيسات — لوحة تحكم المشرف العام
      </footer>
    </div>
  );
}
