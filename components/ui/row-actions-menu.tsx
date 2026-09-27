"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Loader2 } from "lucide-react";

export type RowAction = {
  label: string;
  /** May return a promise; while it is in flight every menu item is disabled. */
  onSelect?: () => void | Promise<unknown>;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
};

type RowActionsMenuProps = {
  actions: RowAction[];
  label?: string;
};

/**
 * Three-dots row actions menu. Renders the dropdown in a fixed-position
 * portal anchored to the button, so it never gets clipped by the ag-grid
 * viewport overflow.
 */
export function RowActionsMenu({ actions, label = "إجراءات" }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // The portal is anchored with translateX(-100%), so a trigger near the
  // viewport's left edge (RTL actions columns) — or a menu taller than the
  // estimate in toggle() — can end up off-screen on narrow phones. Once the
  // menu is measured, nudge the coordinates back inside the viewport.
  useLayoutEffect(() => {
    if (!open || !coords) return;
    const menu = menuRef.current;
    if (!menu) return;
    const margin = 8;
    const { offsetWidth: width, offsetHeight: height } = menu;
    const left = Math.max(Math.min(coords.left, window.innerWidth - margin), width + margin);
    const top = Math.max(Math.min(coords.top, window.innerHeight - margin - height), margin);
    if (left !== coords.left || top !== coords.top) {
      setCoords({ top, left });
    }
  }, [open, coords]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function toggle() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = actions.length * 40 + 16;
      // RTL dashboard: anchor the menu's right edge to the button's right edge.
      const top = rect.bottom + estimatedHeight + 8 > window.innerHeight
        ? Math.max(8, rect.top - estimatedHeight - 8)
        : rect.bottom + 4;
      setCoords({ top, left: rect.right });
    }
    setOpen((current) => !current);
  }

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            dir="rtl"
            className="fixed z-[200] min-w-44 overflow-hidden rounded-xl border border-[#dce6ee] bg-white py-1.5 shadow-[0_18px_50px_rgba(0,19,76,.18)]"
            style={{ top: coords.top, left: coords.left, transform: "translateX(-100%)" }}
          >
            {actions.map((action) => {
              const isPending = pendingAction === action.label;
              const className = `flex w-full items-center gap-2 px-4 py-2.5 text-right text-sm font-semibold transition hover:bg-[#eaf6ff] ${
                action.danger ? "text-[#dc2626] hover:bg-red-50" : "text-[#17212b]"
              } ${action.disabled || pendingAction !== null ? "pointer-events-none opacity-40" : ""}`;
              if (action.href) {
                return (
                  <a key={action.label} role="menuitem" href={action.href} className={className} onClick={() => setOpen(false)}>
                    {action.label}
                  </a>
                );
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled || pendingAction !== null}
                  className={className}
                  onClick={() => {
                    setOpen(false);
                    const result = action.onSelect?.();
                    if (result && typeof result.then === "function") {
                      setPendingAction(action.label);
                      void Promise.resolve(result).finally(() => setPendingAction(null));
                    }
                  }}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {action.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className={`grid size-8 place-items-center rounded-lg border transition ${
          open
            ? "border-[#059ff8] bg-[#eaf6ff] text-[#00134c]"
            : "border-transparent bg-transparent text-[#5e6b78] hover:border-[#d8e4ec] hover:bg-[#f8fbfd] hover:text-[#00134c]"
        }`}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}
