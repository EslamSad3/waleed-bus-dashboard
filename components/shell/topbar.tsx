import { MobileNav } from "@/components/shell/mobile-nav";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { BusFront, ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n/t";

export function Topbar({ email }: { email: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[#f4f8fc]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Phone-only drawer toggle; the drawer it controls lives in mobile-nav.tsx */}
          <MobileNav />
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#00134c] text-white shadow-lg shadow-[#00134c]/15 sm:size-11">
            <BusFront className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold text-[#00134c] sm:text-lg">
              {t("shell.topbar.brand")}
            </div>
            <div className="hidden items-center gap-1 text-[11px] font-semibold text-[#5e6b78] sm:flex">
              <ShieldCheck className="size-3.5 text-[#059ff8]" aria-hidden="true" />
              {t("shell.topbar.subtitle")}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <span className="hidden max-w-48 truncate text-xs text-[#5e6b78] xl:block" aria-label={t("shell.topbar.accountAria")}>
            {email ?? t("shell.topbar.superAdmin")}
          </span>
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d6eeff] text-xs font-extrabold text-[#00134c]"
            title={email ?? t("shell.topbar.superAdmin")}
          >
            {(email ?? t("shell.topbar.avatarInitial")).slice(0, 1).toUpperCase()}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
