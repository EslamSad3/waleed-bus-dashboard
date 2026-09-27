"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      toast.error("حصلت مشكلة", { description: "مشكلة في الاتصال بالسيرفر", duration: 6000 });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} loading={busy} aria-label="تسجيل الخروج">
      <LogOut aria-hidden="true" />
      <span className="hidden sm:inline">{busy ? "جاري الخروج…" : "خروج"}</span>
    </Button>
  );
}
