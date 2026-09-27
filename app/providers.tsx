"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

/**
 * Single app-wide TanStack Query cache. Mutations write their results straight
 * into the cache (setQueryData) so lists update instantly when a dialog closes
 * — no refetch spinner — and only touched keys are invalidated in the
 * background afterwards.
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
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        {children}
        <Toaster />
      </ConfirmDialogProvider>
    </QueryClientProvider>
  );
}
