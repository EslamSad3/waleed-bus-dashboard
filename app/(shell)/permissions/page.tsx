"use client";

import { useMemo } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPermissionCatalog, type Permission } from "@/lib/actions/permissions";
import { qk, useApiQuery } from "@/lib/queries";
import { presentPermission } from "@/lib/permission-presentation";
import { t } from "@/lib/i18n/t";

type FirstPage = { items: Permission[]; nextCursor: string | null };

/**
 * Read-only explanation of backend-supported capabilities. Random catalog
 * entries do not create a feature; access is granted from a role instead.
 */
export default function PermissionsPage() {
  const { data: catalog, isLoading, error } = useApiQuery<Permission[]>(qk.permissions, fetchPermissionCatalog);
  const first: FirstPage | null = catalog ? { items: catalog, nextCursor: null } : null;
  const permissionColumns: CommunityColumnDef<Permission>[] = [
    {
      headerName: t("permissions.columns.action"),
      flex: 1,
      valueGetter: (params) => (params.data ? presentPermission(params.data).title : ""),
      cellRenderer: (params: { data?: Permission }) => params.data ? <span className="font-bold text-[#1a1a1a]">{presentPermission(params.data).title}</span> : null,
    },
    {
      headerName: t("permissions.columns.description"),
      flex: 2,
      valueGetter: (params) => (params.data ? presentPermission(params.data).description : ""),
      cellRenderer: (params: { data?: Permission }) => params.data ? <span className="text-sm text-[#5e6b78]">{presentPermission(params.data).description}</span> : null,
    },
    {
      headerName: t("common.fields.status"),
      cellRenderer: (params: { data?: Permission }) => params.data ? <span className={params.data.isActive ? "status-pill" : "status-pill status-pill-muted"}>{params.data.isActive ? t("permissions.assignable") : t("permissions.notAssignable")}</span> : null,
    },
  ];

  const grouped = useMemo(() => (first?.items ?? []).reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = presentPermission(permission).group;
    (groups[group] ??= []).push(permission);
    return groups;
  }, {}), [first]);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("permissions.title")}</h1>
          <p className="page-description">{t("permissions.description")}</p>
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <div className="space-y-5">{[0, 1, 2].map((section) => <section key={section} className="panel-card p-5 sm:p-6"><Skeleton className="mb-4 h-5 w-28" /><TableSkeleton rows={4} columns={3} /></section>)}</div> : <div className="space-y-5">{Object.entries(grouped).map(([group, permissions]) => <section key={group} className="panel-card p-5 sm:p-6"><h2 className="section-title mb-4">{group}</h2><CursorList<Permission>
        gridId={`permissions-${group}`}
        initialItems={permissions}
        initialCursor={null}
        loadMore={async () => ({ items: [], nextCursor: null })}
        keyOf={(permission) => permission.id}
        withActions={false}
        columnDefs={permissionColumns}
        emptyMessage={t("permissions.empty")}
      /></section>)}</div>}
    </div>
  );
}
