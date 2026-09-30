"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearUserCache } from "@/lib/cache/mutations";
import { useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      toast.error(t("common.error.somethingWentWrong"), { description: t("common.error.network"), duration: 6000 });
    } finally {
      // The whole cache is per-SESSION data (rows fetched as this operator, the
      // chosen owner scope, the derived trip labels). Signing out must not leave
      // any of it for whoever signs in next on this browser.
      clearUserCache(queryClient);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} loading={busy} aria-label={t("shell.signOut.aria")}>
      <LogOut aria-hidden="true" />
      <span className="hidden sm:inline">{busy ? t("common.loading.signingOut") : t("shell.signOut.label")}</span>
    </Button>
  );
}
