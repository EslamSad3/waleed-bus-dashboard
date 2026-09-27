import { conflictMessage, type ConflictKey } from "@/lib/errors";

/**
 * Client-callable BFF action helpers (P0 login precedent: client fetch to
 * same-origin `/api/*`; cookies httpOnly auto-attach, Origin checked
 * server-side). The proxy already returns Arabic `message`s; these helpers add
 * typing + per-screen bare-409 `CONFLICT` context (research R3).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; fields?: Record<string, string> };

type ApiEnvelope<T> = {
  statusCode: number;
  code?: string;
  message?: string;
  data?: T;
  details?: { fields?: Record<string, string | string[]> };
};

function normalizeFields(raw: Record<string, string | string[]> | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join("، ") : v]),
  );
}

async function parse<T>(res: Response, conflictKey?: ConflictKey): Promise<ActionResult<T>> {
  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.ok && payload && "data" in payload && payload.data !== undefined) {
    return { ok: true, data: payload.data as T };
  }
  // DELETE-style 200s may carry data: null — treat ok-status as success.
  if (res.ok) return { ok: true, data: null as T };
  const code = payload?.code;
  const message =
    code === "CONFLICT" && conflictKey
      ? conflictMessage(conflictKey)
      : (payload?.message ?? "حصلت مشكلة، حاول تاني");
  return { ok: false, message, code, fields: normalizeFields(payload?.details?.fields) };
}

export async function apiGet<T>(path: string, fleetId?: string | null): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      headers: fleetId ? { "x-fleet-id": fleetId } : {},
      cache: "no-store",
    });
    return parse<T>(res);
  } catch {
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
  }
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  conflictKey?: ConflictKey,
  fleetId?: string | null,
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(fleetId ? { "x-fleet-id": fleetId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parse<T>(res, conflictKey);
  } catch {
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
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
  if (!IMAGE_MIMES.includes(file.type)) return "الصورة لازم تكون JPEG أو PNG أو WebP";
  if (file.size > MAX_IMAGE_BYTES) return "حجم الصورة لازم يكون 5 ميجا أو أقل";
  if (file.size === 0) return "ملف الصورة فاضي";
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
  scope: { fleetId: string } | { userId?: string },
  signal?: AbortSignal,
): Promise<ActionResult<StagedUpload>> {
  const invalid = validateImageFile(file);
  if (invalid) {
    const code = file.size > MAX_IMAGE_BYTES ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE_TYPE";
    return { ok: false, message: invalid, code };
  }
  const signPath =
    "fleetId" in scope ? `/api/fleets/${scope.fleetId}/uploads/sign` : "/api/uploads/sign";
  // scopeId namespaces the staged path; create-flows omit it (server scopes
  // to the actor) since the target record does not exist yet.
  const signBody =
    "fleetId" in scope
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
      return { ok: false, message: "رفع الصورة فشل، حاول تاني", code: "STORAGE_UPLOAD_FAILED" };
    }
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, message: "رفع الصورة أخد وقت أطول من اللازم — حاول تاني", code: "UPSTREAM_TIMEOUT" };
    }
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
  }
  const { bucket, path, publicUrl } = signed.data;
  return { ok: true, data: { bucket, path, publicUrl } };
}

/** Best-effort staged cleanup (cancel / failed record write). Never throws. */
export async function apiDiscardStaged(
  staged: StagedUpload,
  scope?: { fleetId: string },
): Promise<void> {
  try {
    const path = scope ? `/api/fleets/${scope.fleetId}/uploads/staged-delete` : "/api/uploads/staged";
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
    return parse<T>(res);
  } catch {
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
  }
}

/**
 * Maps over items with bounded parallelism. The dashboard fans out
 * fleet-scoped reads; unbounded Promise.all exhausts the backend's
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
