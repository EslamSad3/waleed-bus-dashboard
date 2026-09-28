import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

const ERROR_TITLE = t("common.error.somethingWentWrong");

export type NotifyOptions = { notify?: boolean };

/**
 * Toast feedback for every mutation, fired centrally in lib/actions wrappers
 * so no call site can forget it. Success always toasts `successCopy`; failures
 * toast the proxy's Arabic message — except per-field validation failures,
 * which stay silent because the form maps `fields` onto its inputs inline.
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
  } else if (!result.fields) {
    toast.error(ERROR_TITLE, { description: result.message, duration: 6000 });
  }
  return result;
}
