import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

  const heads = await headers();
  const pathname = heads.get("x-pathname") ?? "/";

  return (
    <div className="page-bg min-h-screen">
      <Topbar email={session.email} />
      <div className="mx-auto flex max-w-7xl gap-2 px-2 py-4">
        <Sidebar active={pathname} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="border-t border-slate-200 py-4 text-center text-sm text-[#606060]">
        منصة الأتوبيسات — لوحة تحكم المشرف العام
      </footer>
    </div>
  );
}
