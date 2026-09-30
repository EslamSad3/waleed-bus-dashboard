"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { RECORD_MUTATED_EVENT } from "@/lib/actions/http";

/**
 * The single app-wide TanStack Query cache.
 *
 * ONE client for the whole browser session: a dialog on the detail page and the
 * list behind it must read and write the SAME cache, or a successful save is
 * invisible on the way back. It is created once per mount and never per route.
 *
 * Successful record mutations invalidate the shared cache through an event
 * from the HTTP layer. Known list/detail views also receive an immediate,
 * shape-safe patch from `lib/cache/mutations.ts` before the refetch finishes.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = undefined;
        // Covers mutation callers that do not have a local cache impact map.
        // Active pages refetch now; inactive pages are stale on return.
        void queryClient.invalidateQueries();
      }, 0);
    };
    window.addEventListener(RECORD_MUTATED_EVENT, refresh);
    return () => {
      window.removeEventListener(RECORD_MUTATED_EVENT, refresh);
      if (pending) clearTimeout(pending);
    };
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        {children}
        <Toaster />
      </ConfirmDialogProvider>
    </QueryClientProvider>
  );
}
