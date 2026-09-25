"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  closeLabel?: string;
};

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  closeLabel = "إغلاق النافذة",
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // onOpenChange arrives as a fresh inline arrow on every parent render.
  // Depending on it directly would tear down + re-run the focus effect on
  // every keystroke inside the dialog (stealing focus out of text inputs
  // mid-typing). The ref keeps the effect mounted once per open state.
  const onOpenChangeRef = useRef(onOpenChange);
  // Runs every render: keeps the latest callback without re-subscribing
  // the focus effect below (ref writes inside effects are safe).
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(focusableSelector);
    window.requestAnimationFrame(() => (first ?? panel)?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 cursor-default bg-[#0e0b2c]/45 backdrop-blur-md motion-safe:animate-[fade-in_180ms_ease-out]"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-white/80 bg-white shadow-[0_28px_90px_rgba(14,11,44,.28)] outline-none motion-safe:animate-[dialog-in_200ms_ease-out] sm:rounded-[2rem]",
          size === "sm" && "sm:max-w-lg",
          size === "md" && "sm:max-w-2xl",
          size === "lg" && "sm:max-w-4xl",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e4ecf2] bg-[#f8fbfd]/95 px-5 py-5 sm:px-7">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold text-[#204c6b] sm:text-2xl">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-[#687886]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d8e4ec] bg-white text-[#5e6b78] transition hover:border-[#b9d2e3] hover:bg-[#edf6fc] hover:text-[#204c6b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f719e]/15"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
