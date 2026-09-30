import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

const ERROR_TITLE = t("common.error.somethingWentWrong");

export type NotifyOptions = {
  /** Set false for a composed step whose caller shows the outcome itself. */
  notify?: boolean;
  /**
   * The form behind this action renders the returned `fields` inline (or in its
   * error summary), so the toast would repeat what is already on screen.
   *
   * The DEFAULT is the opposite — a failure always says something. Silently
   * swallowing a rejection because a payload happened to carry field errors was
   * how a form with no field UI ended up looking like nothing happened.
   */
  rendersFieldErrors?: boolean;
};

/**
 * The dashboard's single notification point for action wrappers, so no call site
 * can forget it: a success toasts `successCopy`, a failure toasts the proxy's
 * ARABIC message (the API's English text never reaches this layer), and a
 * per-field failure is folded into the same toast unless the form already shows
 * it.
 */
export async function notifyResult<T>(
  successCopy: string,
  action: Promise<ActionResult<T>>,
  opts?: NotifyOptions,
): Promise<ActionResult<T>> {
  const result = await action;
  if (opts?.notify === false) return result;
  if (result.ok) {
    toast.success(successCopy);
    return result;
  }
  if (result.fields && opts?.rendersFieldErrors) return result;
  const fieldLines = Object.values(result.fields ?? {}).filter(
    (message) => message && message !== result.message,
  );
  toast.error(ERROR_TITLE, {
    description: [result.message, ...fieldLines].join(" · "),
    duration: 6000,
  });
  return result;
}
