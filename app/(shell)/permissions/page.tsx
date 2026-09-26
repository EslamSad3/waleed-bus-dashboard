"use client";

import { useMemo } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchPermissionCatalog, type Permission } from "@/lib/actions/permissions";
import { qk, useApiQuery } from "@/lib/queries";
import { presentPermission } from "@/lib/permission-presentation";

type FirstPage = { items: Permission[]; nextCursor: string | null };

/**
 * Read-only explanation of backend-supported capabilities. Random catalog
 * entries do not create a feature; access is granted from a role instead.
 */
export default function PermissionsPage() {
  const { data: catalog, isLoading, error } = useApiQuery<Permission[]>(qk.permissions, fetchPermissionCatalog);
  const first: FirstPage | null = catalog ? { items: catalog, nextCursor: null } : null;
  const grouped = useMemo(() => (first?.items ?? []).reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = presentPermission(permission).group;
    (groups[group] ??= []).push(permission);
    return groups;
  }, {}), [first]);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">دليل المهام</h1>
          <p className="page-description">شرح للمهام المتاحة داخل المنصة. لتحديد من يستطيع تنفيذها، افتح مستوى الوصول المناسب.</p>
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <div className="space-y-5">{Object.entries(grouped).map(([group, permissions]) => <section key={group} className="panel-card p-5 sm:p-6"><h2 className="section-title mb-4">{group}</h2><CursorList<Permission>
        initialItems={permissions}
        initialCursor={null}
        loadMore={async () => ({ items: [], nextCursor: null })}
        keyOf={(permission) => permission.id}
        emptyMessage="لا توجد مهام في هذه المجموعة"
        renderItem={(permission) => { const presentation = presentPermission(permission); return <div className="list-card"><span><span className="block font-semibold text-[#1a1a1a]">{presentation.title}</span><span className="text-sm text-[#606060]">{presentation.description}</span></span><span className={permission.isActive ? "status-pill" : "status-pill status-pill-muted"}>{permission.isActive ? "متاحة للتعيين" : "غير متاحة حاليًا"}</span></div>; }}
      /></section>)}</div>}
    </div>
  );
}
