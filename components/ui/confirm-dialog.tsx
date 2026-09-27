"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for deletes and session-ending actions. */
  destructive?: boolean;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based replacement for window.confirm: `if (!(await confirm({...}))) return;`
 * One provider app-wide; the prompt renders through the shared Dialog primitive.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // A prompt replacing a still-pending one dismisses the old promise as "no".
    resolverRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOptions(null);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
        title={options?.title ?? ""}
        description={options?.description}
        size="sm"
      >
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "إلغاء"}
          </Button>
          <Button
            type="button"
            variant={options?.destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? "تأكيد"}
          </Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  return confirm;
}
