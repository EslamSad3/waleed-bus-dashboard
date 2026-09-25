"use client";

import { useEffect, useState } from "react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchOpsNotifications, type OpsNotification } from "@/lib/actions/notifications";
import { SendNotificationDialog } from "@/components/notifications/send-notification-dialog";
import { CheckCircle2, Send } from "lucide-react";

const CATEGORY_AR: Record<string, string> = {
  TEXT: "تنبيه",
  TRIP: "رحلة",
  DISCOUNT_CODE: "كود خصم",
};

export default function NotificationsOpsPage() {
  const [rows, setRows] = useState<OpsNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState("");

  async function load() {
    setError(null);
    const result = await fetchOpsNotifications({
      userId: userId.trim() || undefined,
      category: category || undefined,
    });
    if (result.ok) {
      setRows(result.data.items);
      setError(null);
    } else {
      setError(result.message);
    }
  }

  function handleSendSuccess(msg?: string) {
    if (msg) {
      setSuccessNote(msg);
      setTimeout(() => setSuccessNote(null), 5000);
    }
    void load();
  }

  useEffect(() => {
    fetchOpsNotifications().then((result) => {
      if (result.ok) {
        setRows(result.data.items);
        setError(null);
      } else {
        setError(result.message);
      }
    });
  }, []);

  const columns: CommunityColumnDef<OpsNotification>[] = [
    {
      field: "category",
      headerName: "الفئة",
      width: 120,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data ? (
          <span className="status-pill status-pill-muted">
            {CATEGORY_AR[params.data.category] ?? params.data.category}
          </span>
        ) : null,
    },
    { field: "title", headerName: "العنوان", flex: 1.5 },
    {
      field: "body",
      headerName: "المحتوى",
      flex: 2,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data?.body ? (
          <span className="line-clamp-2 text-xs text-[#5e6b78]">{params.data.body}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      headerName: "المستلم",
      flex: 1.5,
      cellRenderer: (params: { data?: OpsNotification }) => {
        if (!params.data) return null;
        const user = params.data.user;
        if (user?.name || user?.phoneNumber) {
          return (
            <div className="flex flex-col text-xs leading-tight py-1">
              <span className="font-bold text-[#1a1a1a]">{user.name ?? "مستخدم"}</span>
              {user.phoneNumber && (
                <span dir="ltr" className="text-[#5e6b78]">
                  {user.phoneNumber}
                </span>
              )}
            </div>
          );
        }
        return (
          <span dir="ltr" className="font-mono text-xs text-[#5e6b78]">
            {params.data.userId ? `${params.data.userId.slice(0, 8)}…` : "—"}
          </span>
        );
      },
    },
    {
      field: "isRead",
      headerName: "الحالة",
      width: 120,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data ? (
          <span className={params.data.isRead ? "status-pill status-pill-muted" : "status-pill"}>
            {params.data.isRead ? "مقروء" : "غير مقروء"}
          </span>
        ) : null,
    },
    {
      field: "createdAt",
      headerName: "التاريخ",
      width: 170,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data ? (
          <span dir="ltr" className="text-xs">
            {new Date(params.data.createdAt).toLocaleString("ar-EG")}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الإشعارات</h1>
          <p className="page-description">
            عرض تشغيلي لسجل إشعارات المستخدمين وإرسال إشعارات عامة أو فردية مباشرة إلى حساباتهم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSendDialogOpen(true)}
            className="gap-2 bg-[#2f719e] hover:bg-[#204c6b]"
          >
            <Send className="size-4" />
            <span>إرسال إشعار جديد</span>
          </Button>
          <Button variant="secondary" onClick={() => void load()}>
            تحديث
          </Button>
        </div>
      </div>

      {successNote && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 animate-in fade-in"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          dir="ltr"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="فلترة برقم المستخدم (UUID)"
        />
        <select
          className="rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">كل الفئات</option>
          <option value="TEXT">تنبيه</option>
          <option value="TRIP">رحلة</option>
          <option value="DISCOUNT_CODE">كود خصم</option>
        </select>
        <Button onClick={() => void load()}>بحث</Button>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!rows ? (
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      ) : (
        <AgGridTable<OpsNotification>
          key={rows.map((n) => `${n.id}:${n.isRead}`).join("|")}
          gridId="notifications-ops"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد إشعارات بعد."
          getRowId={(n) => n.id}
        />
      )}

      <SendNotificationDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
}
