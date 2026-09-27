"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarLinks } from "@/components/shell/sidebar";

/**
 * Phone-only navigation (below md): hamburger toggle in the topbar plus an
 * off-canvas drawer sliding from the right — the same edge the desktop
 * sidebar sits on in RTL. Overlay click, Escape, navigation, link tap, or
 * resizing up to md all close it; body scroll is locked while open.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // If the viewport grows past md while the drawer is open, close it so the
    // (display:none) drawer can't leave body scroll locked.
    const desktopMql = window.matchMedia("(min-width: 768px)");
    const onDesktopChange = () => {
      if (desktopMql.matches) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    desktopMql.addEventListener("change", onDesktopChange);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktopMql.removeEventListener("change", onDesktopChange);
      document.body.style.overflow = previousOverflow;
      if (panelRef.current?.contains(document.activeElement)) {
        toggleRef.current?.focus();
      }
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل"}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#dce6ee] bg-white/90 text-[#00134c] shadow-[0_10px_35px_rgba(0,19,76,.07)] transition-colors hover:bg-[#eaf6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25 md:hidden"
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
      </button>

      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 bg-[#00134c]/45 backdrop-blur-sm transition-all duration-300 md:hidden",
          open ? "opacity-100" : "invisible opacity-0",
        )}
      />

      {/* Drawer panel */}
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="التنقل الرئيسي"
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden rounded-e-2xl border border-white/80 bg-white/95 p-3 shadow-[0_18px_55px_rgba(0,19,76,.11)] backdrop-blur-xl outline-none transition-all duration-300 ease-out md:hidden",
          open ? "visible translate-x-0" : "invisible translate-x-full",
        )}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2 rounded-2xl bg-[#00134c] px-3 py-3 text-white">
          <span className="flex items-center gap-2 text-xs font-bold">
            <Sparkles className="size-4 text-[#9ed0f0]" aria-hidden="true" />
            مساحة الإدارة
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="grid size-8 place-items-center rounded-xl text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pb-3">
          <SidebarLinks />
        </nav>
      </div>
    </>
  );
}
