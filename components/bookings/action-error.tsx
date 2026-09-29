"use client";

import { AlertTriangle } from "lucide-react";
import type { ActionResult } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

/**
 * Field-level error plumbing for the booking action dialogs.
 *
 * The API already answers with `details.fields` (class-validator via the
 * validation pipe, zod at the proxy). The action layer keeps it on
 * `ActionResult.fields`, but the dialogs were rendering only the summary
 * message, so a precise reason like "سبب الإلغاء إلزامي" was replaced by the
 * generic "راجع الحقول المطلوبة". These two helpers let every dialog show the
 * real message once, the same way the login form does with `form.setError`.
 */

/** The message the backend gave for one field, if any. */
export function fieldError(
  result: { fields?: Record<string, string> } | null | undefined,
  ...names: string[]
): string | null {
  if (!result?.fields) return null;
  for (const name of names) {
    const message = result.fields[name];
    if (message) return message;
  }
  return null;
}

/**
 * The alert body for a failed action: the summary line, plus one line per field
 * error so the operator sees which input is wrong and why.
 */
export function actionErrorLines(
  result: Extract<ActionResult<unknown>, { ok: false }>,
): string[] {
  const lines = [result.message];
  for (const message of Object.values(result.fields ?? {})) {
    if (message && !lines.includes(message)) lines.push(message);
  }
  return lines;
}

/** Inline message under one input. Renders nothing when the field is fine. */
export function FieldError({
  errors,
  name,
  className = "mt-1 text-xs text-red-600",
}: {
  errors?: Record<string, string> | null;
  name: string;
  className?: string;
}) {
  const message = fieldError(errors, name);
  if (!message) return null;
  return (
    <p className={className} role="alert">
      {message}
    </p>
  );
}

/** Fallback copy for a field the backend rejected without naming a rule. */
export const UNKNOWN_FIELD_MESSAGE = t("errors.invalidField");

/**
 * The shared red alert used by every booking action dialog: the summary line
 * plus one line per field error, so a rejected action explains itself instead of
 * only saying "check the required fields".
 */
export function ActionErrorAlert({
  error,
  fields,
}: {
  error: string | null;
  fields?: Record<string, string> | null;
}) {
  if (!error && !fields) return null;
  const extra = Object.values(fields ?? {}).filter(
    (message) => message && message !== error,
  );
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <ul className="space-y-0.5">
        {error ? <li>{error}</li> : null}
        {extra.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
