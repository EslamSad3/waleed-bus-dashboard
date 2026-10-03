"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/t";

/**
 * Single back button mounted once in the shell layout, above the page
 * content. Goes back exactly one step in history; a direct landing with no
 * in-app history falls back to the overview instead of leaving the dashboard.
 */
export function BackButton() {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#2f719e] shadow-[0_8px_25px_rgba(29,64,89,.08)] transition hover:bg-[#eaf6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        {t("common.actions.back")}
      </button>
    </div>
  );
}
