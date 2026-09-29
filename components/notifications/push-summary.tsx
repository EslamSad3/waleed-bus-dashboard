"use client";

import { pushSummaryLines } from "@/lib/i18n/push-summary";
import type { PushSummary } from "@/lib/actions/notifications";

/**
 * Inbox saves and push delivery are shown separately on purpose:
 * `sentCount` is rows committed to PostgreSQL, while the FCM numbers are only
 * submissions the API accepted. Presenting them as one number would claim a
 * delivery guarantee that neither service makes.
 *
 * `status: "incomplete"` means dispatch stopped early, so the device counts are
 * partial; `status: "disabled"` means push is switched off and nothing was sent.
 */
export function PushSummaryLines({
  push,
  sentCount,
}: {
  push?: PushSummary;
  sentCount: number;
}) {
  if (!push) return null;
  return (
    <>
      {pushSummaryLines(push, sentCount).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}
