"use client";

import { useEffect, useState } from "react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchOpsNotifications, type OpsNotification } from "@/lib/actions/notifications";

const CATEGORY_AR: Record<string, string> = {
  TEXT: "تنبيه",
  TRIP: "رحلة",
  DISCOUNT_CODE: "كود خصم",
};

export default function NotificationsOpsPage() {
  const [rows, setRows] = useState<OpsNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState("");

  async function load() {
    setError(null);
    const result = await fetchOpsNotifications({
      userId: userId.trim() || undefined,
      category: category || undefined,
    });
    if (result.ok) { setRows(result.data.items); setError(null); }
    else setError(result.message);
  }

  useEffect(() => {
    fetchOpsNotifications().then((result) => {
      if (result.ok) { setRows(result.data.items); setError(null); }
      else setError(result.message);
    });
  }, []);

  const columns: CommunityColumnDef<OpsNotification>[] = [
    {
      field: "category",
      headerName: "الفئة",
      cellRenderer: (params: { data?: OpsNotification }) => params.data ? <span>{CATEGORY_AR[params.data.category] ?? params.data.category}</span> : null,
    },
    { field: "title", headerName: "العنوان", flex: 2 },
    {
      field: "isRead",
      headerName: "الحالة",
      cellRenderer: (params: { data?: OpsNotification }) => params.data ? <span className={params.data.isRead ? "status-pill status-pill-muted" : "status-pill"}>{params.data.isRead ? "مقروء" : "غير مقروء"}</span> : null,
    },
    {
      field: "createdAt",
      headerName: "التاريخ",
      cellRenderer: (params: { data?: OpsNotification }) => params.data ? <span dir="ltr" className="text-xs">{new Date(params.data.createdAt).toLocaleString("ar-EG")}</span> : null,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الإشعارات</h1>
          <p className="page-description">عرض تشغيلي لقراءة التوصيل — تُرسل أكواد الخصم المخصصة تلقائيًا لمستخدميها (DISCOUNT_CODE)؛ التنبيهات العامة والمرتبطة بالرحلات قابلة للتوسع.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>تحديث</Button>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input dir="ltr" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="فلترة برقم المستخدم (UUID)" />
        <select className="rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">كل الفئات</option>
          <option value="TEXT">تنبيه</option>
          <option value="TRIP">رحلة</option>
          <option value="DISCOUNT_CODE">كود خصم</option>
        </select>
        <Button onClick={() => void load()}>بحث</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<OpsNotification>
          key={rows.map((n) => `${n.id}:${n.isRead}`).join("|")}
          gridId="notifications-ops"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد إشعارات بعد."
          getRowId={(n) => n.id}
        />
      )}
    </div>
  );
}
