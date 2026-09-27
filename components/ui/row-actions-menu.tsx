"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export type RowAction = {
  label: string;
  onSelect?: () => void;
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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
            id={menuId}
            role="menu"
            aria-label={label}
            dir="rtl"
            className="fixed z-[200] min-w-44 overflow-hidden rounded-xl border border-[#dce6ee] bg-white py-1.5 shadow-[0_18px_50px_rgba(0,19,76,.18)]"
            style={{ top: coords.top, left: coords.left, transform: "translateX(-100%)" }}
          >
            {actions.map((action) => {
              const className = `flex w-full items-center gap-2 px-4 py-2.5 text-right text-sm font-semibold transition hover:bg-[#eaf6ff] ${
                action.danger ? "text-[#dc2626] hover:bg-red-50" : "text-[#17212b]"
              } ${action.disabled ? "pointer-events-none opacity-40" : ""}`;
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
                  disabled={action.disabled}
                  className={className}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect?.();
                  }}
                >
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
