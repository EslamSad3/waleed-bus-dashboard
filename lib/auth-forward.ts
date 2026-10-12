import { NextResponse } from "next/server";
import type { z } from "zod";
import { busFetch } from "@/lib/api";
import { originAllowed } from "@/lib/config";
import { arabiciseDetails, toArabicError } from "@/lib/errors";
import { schemaErrors } from "@/lib/field-validation";
import { t } from "@/lib/i18n/t";

/**
 * Shared body of the password route handlers (/api/auth/password/*): origin
 * check, zod re-validation at the trust boundary, one backend POST, and the
 * same `{statusCode, data}` / Arabic-error shape the generic proxy returns.
 * `signedIn` routes may refresh an expired access cookie; public ones never do.
 */
export async function forwardAuthAction(
  req: Request,
  path: string,
  schema: z.ZodType,
  { signedIn }: { signedIn: boolean },
) {
  if (!originAllowed(req)) {
    return NextResponse.json(
      { statusCode: 403, code: "FORBIDDEN", message: t("common.error.forbidden") },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        statusCode: 400,
        code: "VALIDATION_FAILED",
        message: toArabicError("VALIDATION_FAILED"),
        details: { fields: schemaErrors(schema, raw) },
      },
      { status: 400 },
    );
  }

  const result = await busFetch(path, { method: "POST", body: parsed.data, retryAuth: signedIn });
  if (!result.ok) {
    const status =
      result.status === 0 ? (result.code === "UPSTREAM_TIMEOUT" ? 504 : 503) : result.status;
    return NextResponse.json(
      {
        statusCode: status,
        code: result.code,
        message: toArabicError(result.code, result.status, result.rawMessage),
        ...(result.details ? { details: arabiciseDetails(result.details) } : {}),
        ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}),
      },
      { status },
    );
  }
  return NextResponse.json(
    { statusCode: result.status, data: result.data ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
