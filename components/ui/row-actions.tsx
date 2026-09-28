"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

/**
 * Soft tinted chip + saturated label, matching the dashboard's pill idiom.
 * `danger` is the one solid treatment — it mirrors the destructive buttons
 * used on the detail pages so delete reads the same everywhere.
 * Every tone states its own `hover:text-*` so it wins over the ghost variant
 * it is layered on (twMerge only resolves conflicts it can see).
 */
const TONE_CLASSES = {
  primary: "border-[#cfe4f7] bg-[#eaf6ff] text-[#00134c] hover:bg-[#d6eeff] hover:text-[#00134c]",
  success: "border-[#bbf7d0] bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0] hover:text-[#15803d]",
  warning: "border-[#fde68a] bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a] hover:text-[#b45309]",
  danger: "border-[#dc2626] bg-[#dc2626] text-white hover:border-[#b91c1c] hover:bg-[#b91c1c] hover:text-white",
} as const;

export type RowActionTone = keyof typeof TONE_CLASSES;

export type RowAction = {
  label: string;
  /** Shown before the label; the label itself stays the accessible name. */
  icon: LucideIcon;
  /** May return a promise; while it is in flight every sibling is disabled. */
  onSelect?: () => void | Promise<unknown>;
  href?: string;
  tone?: RowActionTone;
  disabled?: boolean;
};

type RowActionsProps = {
  actions: RowAction[];
  /** Row-level accessible name, e.g. "إجراءات حجز {name}". */
  label?: string;
};

/**
 * Row actions as a visible button group instead of a dropdown: every action is
 * one click away, keyboard-reachable, colour-coded by tone, and labelled in
 * Arabic. Sized for the 48px grid row, so callers should keep it to a handful
 * of short actions.
 */
export function RowActions({ actions, label = t("cursorList.actionsColumn") }: RowActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon;
        const isPending = pendingAction === action.label;
        const blocked = Boolean(action.disabled) || pendingAction !== null;
        const tone = action.tone ?? "primary";
        const chipClasses = cn("border px-2", TONE_CLASSES[tone], blocked && "pointer-events-none opacity-50");
        const className = buttonVariants({ variant: "ghost", size: "sm", className: chipClasses });
        const content = (
          <>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
            <span>{action.label}</span>
          </>
        );

        if (action.href) {
          return (
            <Link key={action.label} href={action.href} aria-label={action.label} title={action.label} className={className}>
              {content}
            </Link>
          );
        }

        return (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            size="sm"
            disabled={blocked}
            aria-busy={isPending || undefined}
            aria-label={action.label}
            title={action.label}
            className={chipClasses}
            onClick={() => {
              const result = action.onSelect?.();
              if (result && typeof result.then === "function") {
                setPendingAction(action.label);
                void Promise.resolve(result).finally(() => setPendingAction(null));
              }
            }}
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}
