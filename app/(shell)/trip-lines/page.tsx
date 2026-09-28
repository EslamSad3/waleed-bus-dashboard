"use client";

import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useQueryClient } from "@/lib/queries";
import { deleteTripLine, fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { qk, removeFromList, useApiQuery } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export default function TripLinesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: lines, isLoading, error } = useApiQuery<TripLine[]>(qk.tripLines, fetchTripLines);

  async function removeLine(line: TripLine) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("tripLines.deleteConfirm.description", { lineName: line.name }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteTripLine(line.id);
    if (!result.ok) return;
    removeFromList<TripLine>(queryClient, qk.tripLines, line.id);
  }

  const columns: CommunityColumnDef<TripLine>[] = [
    { field: "name", headerName: t("tripLines.columns.name"), filter: "agTextColumnFilter" },
    { field: "code", headerName: t("common.fields.code"), filter: "agTextColumnFilter" },
    { field: "origin", headerName: t("common.fields.origin") },
    { field: "destination", headerName: t("common.fields.destination") },
    { colId: "stationCount", headerName: t("tripLines.columns.stops"), valueGetter: (params) => params.data?.stations.length, filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: t("common.fields.status"), valueFormatter: (params) => params.value ? t("common.status.active") : t("common.status.inactive") },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("tripLines.title")}</h1>
          <p className="page-description">{t("tripLines.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {t("tripLines.newLine")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={7} /> : (
        <CursorList<TripLine>
          gridId="trip-lines"
          initialItems={lines ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(line) => line.id}
          columnDefs={columns}
          emptyMessage={t("tripLines.empty")}
          renderItem={(line) => (
            <RowActions
              label={t("tripLines.list.rowActions", { lineName: line.name })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trip-lines/${line.id}` },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeLine(line) },
              ]}
            />
          )}
        />
      )}
      <CreateTripLineDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
