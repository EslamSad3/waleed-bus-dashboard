import { conflictMessage, type ConflictKey } from "@/lib/errors";
import { t } from "@/lib/i18n/t";

export const RECORD_MUTATED_EVENT = "dashboard:record-mutated";

function announceRecordMutation(path: string): void {
  // Upload staging, login and validation do not change dashboard records.
  if (typeof window === "undefined" || /\/api\/(auth|uploads)(\/|$)/.test(path) ||
      path.includes("/uploads/") || path.endsWith("/promotions/validate")) return;
  window.dispatchEvent(new Event(RECORD_MUTATED_EVENT));
}

/**
 * Client-callable BFF action helpers (P0 login precedent: client fetch to
 * same-origin `/api/*`; cookies httpOnly auto-attach, Origin checked
 * server-side). The proxy already returns Arabic `message`s; these helpers add
 * typing + per-screen bare-409 `CONFLICT` context (research R3).
 */
/**
 * The one result shape every call site in `lib/actions` returns.
 *
 * On success `message` carries the API's action-specific English text (a hint
 * for logging/branching — the UI shows the dashboard's own Arabic copy from
 * `toast.ts`). `data` is `T`, and a successful `DELETE` legitimately yields
 * `data: null`, which is why success is keyed on `ok` rather than on data being
 * present.
 */
export type ActionResult<T> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      message: string;
      code?: string;
      fields?: Record<string, string>;
      /** Seconds the client should wait before retrying (429s). */
      retryAfter?: number;
    };

type ApiEnvelope<T> = {
  statusCode: number;
  code?: string;
  message?: string;
  data?: T | null;
  details?: { fields?: Record<string, string | string[]> };
  retryAfter?: number;
};

function normalizeFields(raw: Record<string, string | string[]> | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(t("common.listSeparator")) : v]),
  );
}

/**
 * JSON, multipart, and no-content responses all land on the SAME shape: an
 * ok-status is a success even when `data` is `null` (DELETE), and a failure
 * always carries the proxy's Arabic message plus the code and field errors the
 * caller needs.
 */
async function parse<T>(res: Response, conflictKey?: ConflictKey): Promise<ActionResult<T>> {
  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.ok) {
    return {
      ok: true,
      // A 200 with no body is still a success; `data: null` is a valid payload.
      data: (payload && "data" in payload ? payload.data : null) as T,
      ...(typeof payload?.message === "string" ? { message: payload.message } : {}),
    };
  }
  const code = payload?.code;
  const message =
    code === "CONFLICT" && conflictKey
      ? conflictMessage(conflictKey)
      : (payload?.message ?? t("common.error.unknown"));
  return {
    ok: false,
    message,
    code,
    fields: normalizeFields(payload?.details?.fields),
    ...(typeof payload?.retryAfter === "number" ? { retryAfter: payload.retryAfter } : {}),
  };
}

export async function apiGet<T>(path: string, ownerId?: string | null): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      headers: ownerId ? { "x-owner-id": ownerId } : {},
      cache: "no-store",
    });
    return parse<T>(res);
  } catch {
    return { ok: false, message: t("common.error.network"), code: "NETWORK_ERROR" };
  }
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  conflictKey?: ConflictKey,
  ownerId?: string | null,
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(ownerId ? { "x-owner-id": ownerId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await parse<T>(res, conflictKey);
    if (result.ok) announceRecordMutation(path);
    return result;
  } catch {
    return { ok: false, message: t("common.error.network"), code: "NETWORK_ERROR" };
  }
}

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

/** Staged direct upload: file bytes went straight to Supabase, record not linked yet. */
export type StagedUpload = { bucket: string; path: string; publicUrl: string };

type SignKind = "bus-image" | "user-picture" | "fleet-owner-picture";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Client-side file validation (Arabic message or null when valid). */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_MIMES.includes(file.type)) return t("common.validation.imageType");
  if (file.size > MAX_IMAGE_BYTES) return t("common.validation.imageSize");
  if (file.size === 0) return t("common.validation.imageEmpty");
  return null;
}

type SignResponse = {
  bucket: string;
  path: string;
  uploadUrl: string;
  token: string;
  publicUrl: string;
};

/**
 * Vercel-safe image staging: mint a signed URL via the API (tiny JSON),
 * PUT the bytes straight to Supabase (never crossing a serverless function),
 * and return the staged reference. The caller links `publicUrl` on its
 * record, and MUST call `apiDiscardStaged` when the user cancels or the
 * record write fails so storage does not fill with orphans.
 */
export async function apiStageImage(
  kind: SignKind,
  file: File,
  scope: { ownerId: string } | { userId?: string },
  signal?: AbortSignal,
): Promise<ActionResult<StagedUpload>> {
  const invalid = validateImageFile(file);
  if (invalid) {
    const code = file.size > MAX_IMAGE_BYTES ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE_TYPE";
    return { ok: false, message: invalid, code };
  }
  const signPath =
    "ownerId" in scope ? `/api/fleet-owners/${scope.ownerId}/uploads/sign` : "/api/uploads/sign";
  // scopeId namespaces the staged path; create-flows omit it (server scopes
  // to the actor) since the target record does not exist yet.
  const signBody =
    "ownerId" in scope
      ? { kind, contentType: file.type, sizeBytes: file.size }
      : {
          kind,
          contentType: file.type,
          sizeBytes: file.size,
          ...("userId" in scope && scope.userId ? { scopeId: scope.userId } : {}),
        };
  const signed = await apiSend<SignResponse>(signPath, "POST", signBody);
  if (!signed.ok) return signed;
  try {
    const put = await fetch(signed.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
      signal: signal ?? AbortSignal.timeout(30000),
    });
    if (!put.ok) {
      return { ok: false, message: t("common.error.uploadFailed"), code: "STORAGE_UPLOAD_FAILED" };
    }
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, message: t("common.error.uploadTimeout"), code: "UPSTREAM_TIMEOUT" };
    }
    return { ok: false, message: t("common.error.network"), code: "NETWORK_ERROR" };
  }
  const { bucket, path, publicUrl } = signed.data;
  return { ok: true, data: { bucket, path, publicUrl } };
}

/** Best-effort staged cleanup (cancel / failed record write). Never throws. */
export async function apiDiscardStaged(
  staged: StagedUpload,
  scope?: { ownerId: string },
): Promise<void> {
  try {
    const path = scope ? `/api/fleet-owners/${scope.ownerId}/uploads/staged-delete` : "/api/uploads/staged";
    await apiSend(path, scope ? "POST" : "DELETE", { bucket: staged.bucket, path: staged.path });
  } catch {
    // Staged tmp/... objects without a linked record are harmless.
  }
}

export async function apiSendFile<T>(
  path: string,
  file: File,
  fieldName = "image",
): Promise<ActionResult<T>> {
  try {
    const form = new FormData();
    form.append(fieldName, file);
    const res = await fetch(path, { method: "POST", body: form });
    const result = await parse<T>(res);
    if (result.ok) announceRecordMutation(path);
    return result;
  } catch {
    return { ok: false, message: t("common.error.network"), code: "NETWORK_ERROR" };
  }
}

/**
 * Maps over items with bounded parallelism. The dashboard fans out
 * owner-scoped reads; unbounded Promise.all exhausts the backend's
 * transaction pool (P2024/P2028 "unable to start a transaction").
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
