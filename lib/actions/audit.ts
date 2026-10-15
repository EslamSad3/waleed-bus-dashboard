import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type AuditLogRow = {
  id: string;
  actorUserId?: string | null;
  actorOwnerId?: string | null;
  targetUserId?: string | null;
  targetOwnerId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  createdAt: string;
};

/**
 * Platform audit trail reader.
 * GET /api/audit-logs?cursor=&limit=
 */
export function fetchAuditLogsPage(
  cursor: string | null = null,
  limit = 25,
): Promise<ActionResult<CursorPage<AuditLogRow>>> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return apiGet<CursorPage<AuditLogRow>>(`/api/audit-logs?${query.toString()}`);
}
