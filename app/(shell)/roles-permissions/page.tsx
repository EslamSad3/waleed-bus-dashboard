"use client";

import { useEffect, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchRolesPage, type Role } from "@/lib/actions/roles";
import { fetchPermissionsPage, type Permission } from "@/lib/actions/permissions";

type FirstPage<T> = { items: T[]; nextCursor: string | null };

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<FirstPage<Role> | null>(null);
  const [permissions, setPermissions] = useState<FirstPage<Permission> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchRolesPage(null), fetchPermissionsPage(null)]).then(([rolesResult, permissionsResult]) => {
      if (!active) return;
      if (!rolesResult.ok) {
        setError(rolesResult.message);
        return;
      }
      if (!permissionsResult.ok) {
        setError(permissionsResult.message);
        return;
      }
      setRoles(rolesResult.data);
      setPermissions(permissionsResult.data);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الأدوار والصلاحيات</h1>
          <p className="page-description">عرض أدوار النظام وكتالوج الصلاحيات المرتبط بها.</p>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title mb-4">الأدوار</h2>
          {!roles ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <CursorList<Role>
            initialItems={roles.items}
            initialCursor={roles.nextCursor}
            loadMore={(cursor) => fetchRolesPage(cursor).then((result) => {
              if (!result.ok) throw new Error(result.message);
              return result.data;
            })}
            keyOf={(role) => role.id}
            emptyMessage="لا توجد أدوار متاحة"
            renderItem={(role) => <div className="list-card"><span><span className="block font-semibold text-[#1a1a1a]">{role.name}</span><span dir="ltr" className="text-sm text-[#606060]">{role.slug}</span></span><span className={role.isActive ? "status-pill" : "status-pill status-pill-muted"}>{role.isActive ? "نشط" : "موقوف"}</span></div>}
          />}
        </section>

        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title mb-4">الصلاحيات</h2>
          {!permissions ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <CursorList<Permission>
            initialItems={permissions.items}
            initialCursor={permissions.nextCursor}
            loadMore={(cursor) => fetchPermissionsPage(cursor).then((result) => {
              if (!result.ok) throw new Error(result.message);
              return result.data;
            })}
            keyOf={(permission) => permission.id}
            emptyMessage="لا توجد صلاحيات متاحة"
            renderItem={(permission) => <div className="list-card"><span><span dir="ltr" className="block font-semibold text-[#1a1a1a]">{permission.key}</span><span className="text-sm text-[#606060]">{permission.description || `${permission.resource} · ${permission.action}`}</span></span><span className={permission.isActive ? "status-pill" : "status-pill status-pill-muted"}>{permission.isActive ? "نشط" : "موقوف"}</span></div>}
          />}
        </section>
      </div>
    </div>
  );
}
