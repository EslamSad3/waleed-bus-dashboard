"use client";

import { useMemo, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { fetchAuditLogsPage, type AuditLogRow } from "@/lib/actions/audit";
import { qk, useApiQuery } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "success" | "failed";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const { data: page, isLoading, error } = useApiQuery(
    qk.auditLogs(null),
    () => fetchAuditLogsPage(null, 50),
  );

  const filteredItems = useMemo(() => {
    const items = page?.items ?? [];
    return items.filter((row) => {
      if (statusFilter === "success" && !row.success) return false;
      if (statusFilter === "failed" && row.success) return false;
      if (!search.trim()) return true;

      const q = search.trim().toLowerCase();
      return (
        row.action.toLowerCase().includes(q) ||
        row.resource.toLowerCase().includes(q) ||
        (row.resourceId && row.resourceId.toLowerCase().includes(q)) ||
        (row.actorUserId && row.actorUserId.toLowerCase().includes(q)) ||
        (row.ip && row.ip.toLowerCase().includes(q))
      );
    });
  }, [page?.items, search, statusFilter]);

  const columns: CommunityColumnDef<AuditLogRow>[] = useMemo(
    () => [
      {
        field: "createdAt",
        headerName: t("audit.columns.timestamp"),
        sortable: true,
        width: 170,
        valueFormatter: (params) => {
          if (!params.value) return "—";
          try {
            return new Date(params.value as string).toLocaleString("ar-EG", {
              timeZone: "Africa/Cairo",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch {
            return String(params.value);
          }
        },
      },
      {
        field: "action",
        headerName: t("audit.columns.action"),
        filter: "agTextColumnFilter",
        width: 220,
        cellRenderer: (params: { value: string }) => (
          <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono font-semibold text-slate-800">
            {params.value}
          </code>
        ),
      },
      {
        field: "resource",
        headerName: t("audit.columns.resource"),
        filter: "agTextColumnFilter",
        width: 140,
      },
      {
        field: "resourceId",
        headerName: t("audit.columns.resourceId"),
        width: 140,
        valueFormatter: (params) =>
          params.value ? `${String(params.value).slice(0, 8)}…` : "—",
      },
      {
        field: "actorUserId",
        headerName: t("audit.columns.actor"),
        width: 140,
        valueFormatter: (params) =>
          params.value ? `${String(params.value).slice(0, 8)}…` : t("common.value.system"),
      },
      {
        field: "success",
        headerName: t("audit.columns.status"),
        width: 110,
        cellRenderer: (params: { value: boolean }) => (
          <span
            className={cn(
              "status-pill text-xs font-bold",
              params.value
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : "bg-red-100 text-red-800 border-red-200",
            )}
          >
            {params.value ? t("audit.status.success") : t("audit.status.failed")}
          </span>
        ),
      },
      {
        field: "ip",
        headerName: t("audit.columns.ip"),
        width: 130,
        valueFormatter: (params) => (params.value ? String(params.value) : "—"),
      },
      {
        colId: "actions",
        headerName: t("audit.columns.details"),
        width: 100,
        cellRenderer: (params: { data: AuditLogRow }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLog(params.data)}
            aria-label={t("audit.columns.details")}
          >
            <Eye className="size-4" />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="dashboard-page space-y-6">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("audit.title")}</h1>
          <p className="page-description">{t("audit.description")}</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message || t("common.error.somethingWentWrong")}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", t("audit.filter.allActions")],
              ["success", t("audit.filter.successOnly")],
              ["failed", t("audit.filter.failedOnly")],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
                statusFilter === val
                  ? "border-[#059ff8] bg-[#eaf6ff] text-[#00134c]"
                  : "border-[#dce6ee] bg-white text-[#5e6b78] hover:text-[#00134c]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("audit.filter.searchPlaceholder")}
          aria-label={t("audit.filter.searchPlaceholder")}
          className="md:max-w-xs"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <CursorList<AuditLogRow>
          gridId="audit-logs"
          initialItems={filteredItems}
          initialCursor={page?.nextCursor ?? null}
          loadMore={(cursor) =>
            fetchAuditLogsPage(cursor, 50).then((res) => {
              if (!res.ok) throw new Error(res.message);
              return res.data;
            })
          }
          keyOf={(row) => row.id}
          columnDefs={columns}
          emptyMessage={t("audit.empty")}
          renderItem={(row) => (
            <div className="flex items-center justify-between border-b border-slate-100 p-3">
              <div>
                <p className="font-mono text-sm font-semibold">{row.action}</p>
                <p className="text-xs text-slate-500">
                  {row.resource} · {row.createdAt}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLog(row)}
              >
                <Eye className="size-4" />
              </Button>
            </div>
          )}
        />
      )}

      {selectedLog ? (
        <Dialog
          open={Boolean(selectedLog)}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null);
          }}
          title={t("audit.dialog.title")}
          description={t("audit.dialog.description")}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.action")}</span>
                <p className="font-mono font-bold text-slate-900">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.status")}</span>
                <p className="font-bold">
                  {selectedLog.success ? t("audit.status.success") : t("audit.status.failed")}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.resource")}</span>
                <p className="font-medium text-slate-800">
                  {selectedLog.resource} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ""}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.actor")}</span>
                <p className="font-mono text-xs text-slate-800">
                  {selectedLog.actorUserId ?? t("common.value.system")}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.ip")}</span>
                <p className="font-mono text-xs text-slate-800">{selectedLog.ip ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500">{t("audit.columns.timestamp")}</span>
                <p className="text-xs text-slate-800">{selectedLog.createdAt}</p>
              </div>
            </div>

            {selectedLog.userAgent ? (
              <div>
                <h4 className="mb-1 text-xs font-bold text-slate-600">{t("audit.dialog.userAgent")}</h4>
                <p className="rounded-lg bg-slate-100 p-2 font-mono text-xs text-slate-700 break-all" dir="ltr">
                  {selectedLog.userAgent}
                </p>
              </div>
            ) : null}

            <div>
              <h4 className="mb-1 text-xs font-bold text-slate-600">{t("audit.dialog.metadata")}</h4>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                <pre
                  dir="ltr"
                  className="max-h-60 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-emerald-400"
                >
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500 text-center">
                  {t("audit.dialog.noMetadata")}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedLog(null)}>
                {t("common.actions.close")}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
