import type { PushSummary } from "@/lib/actions/notifications";
import { t } from "./t";

/**
 * Composes the operator-facing lines for one send.
 *
 * Kept out of the components so the "inbox saved" and "push accepted" numbers
 * stay separated everywhere, and out of `ar.json` so the copy itself remains a
 * normal type-checked dictionary key.
 */
export function pushSummaryLines(push: PushSummary, sentCount: number): string[] {
  if (push.status === "disabled") {
    return [
      t("notifications.push.savedInbox", { value: sentCount }),
      t("notifications.push.disabled"),
    ];
  }

  const lines = [
    t("notifications.push.savedInbox", { value: sentCount }),
    t("notifications.push.accepted", { value: push.acceptedDeviceCount }),
  ];

  if (push.failedDeviceCount > 0) {
    lines.push(t("notifications.push.failed", { value: push.failedDeviceCount }));
  }
  if (push.skippedUserCount > 0) {
    lines.push(t("notifications.push.skipped", { value: push.skippedUserCount }));
  }
  if (push.status === "incomplete") {
    // Processing stopped early: the counts above are partial, not final.
    lines.push(t("notifications.push.incomplete"));
  }
  return lines;
}
