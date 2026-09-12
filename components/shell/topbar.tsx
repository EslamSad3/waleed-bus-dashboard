import { FleetScopeSelect } from "@/components/fleet-scope-select";
import { SignOutButton } from "@/components/shell/sign-out-button";

export function Topbar({ email }: { email: string | null }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="text-lg font-bold text-[#1a1a1a]">منصة الأتوبيسات</div>
      <div className="flex items-center gap-3">
        <FleetScopeSelect />
        <span className="text-sm text-[#606060]" aria-label="حساب المشرف">
          {email ?? "مشرف عام"}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
