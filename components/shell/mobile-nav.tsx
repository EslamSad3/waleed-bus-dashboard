"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarLinks } from "@/components/shell/sidebar";
import { t } from "@/lib/i18n/t";

/** Stable no-op subscription: the client snapshot never changes. */
const subscribeToNothing = () => () => {};

/**
 * Phone-only navigation (below md): hamburger toggle in the topbar plus an
 * off-canvas drawer sliding from the right — the same edge the desktop
 * sidebar sits on in RTL. Overlay click, Escape, navigation, link tap, or
 * resizing up to md all close it; body scroll is locked while open.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  // The overlay and drawer are portalled to <body>: this component lives inside
  // the sticky topbar, and a `backdrop-filter` on an ancestor (that header has
  // one) makes it the containing block for position:fixed children. Without the
  // portal the drawer was sized and placed against the 60px header instead of
  // the viewport — clipped off-screen, with an overlay covering only the top
  // strip so tapping outside never closed it.
  //
  // useSyncExternalStore is the hydration-safe "am I on the client?" probe: the
  // server snapshot is false, the first client snapshot is true, and React
  // re-renders after hydration. A `useState`+`useEffect` pair is the common
  // alternative but trips react-hooks/set-state-in-effect.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close whenever the route changes (render-time state reset).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const toggle = toggleRef.current;

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
    panel?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktopMql.removeEventListener("change", onDesktopChange);
      document.body.style.overflow = previousOverflow;
      if (panel?.contains(document.activeElement)) {
        toggle?.focus();
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
        aria-label={open ? t("shell.nav.closeAria") : t("shell.nav.openAria")}
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#dce6ee] bg-white/90 text-[#00134c] shadow-[0_10px_35px_rgba(0,19,76,.07)] transition-colors hover:bg-[#eaf6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25 md:hidden"
      >
        {open ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Menu aria-hidden="true" className="size-5" />
        )}
      </button>

      {mounted
        ? createPortal(
            <>
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
                aria-label={t("shell.nav.mainAria")}
                tabIndex={-1}
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden rounded-e-2xl border border-white/80 bg-white/95 p-3 shadow-[0_18px_55px_rgba(0,19,76,.11)] backdrop-blur-xl outline-none transition-all duration-300 ease-out md:hidden",
                  open ? "visible translate-x-0" : "invisible translate-x-full",
                )}
              >
                <div className="mb-3 flex shrink-0 items-center justify-between gap-2 rounded-2xl bg-[#00134c] px-3 py-3 text-white">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <Sparkles className="size-4 text-[#9ed0f0]" aria-hidden="true" />
                    {t("shell.nav.adminArea")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("shell.nav.closeMenuAria")}
                    className="grid size-8 place-items-center rounded-xl text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pb-3">
                  <SidebarLinks />
                </nav>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
