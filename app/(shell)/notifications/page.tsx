"use client";

import { useEffect, useMemo, useState } from "react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchOpsNotifications, type OpsNotification } from "@/lib/actions/notifications";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";
import { SendNotificationDialog } from "@/components/notifications/send-notification-dialog";
import { CheckCircle2, RotateCcw, Search, Send, User } from "lucide-react";

const CATEGORY_AR: Record<string, string> = {
  TEXT: "تنبيه",
  TRIP: "رحلة",
  DISCOUNT_CODE: "كود خصم",
};

function matchesQuery(text: string | null | undefined, query: string): boolean {
  if (!text || !query) return false;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

function matchesPhone(phone: string | null | undefined, query: string): boolean {
  if (!phone || !query) return false;
  const cleanPhone = phone.replace(/\D/g, "");
  const cleanQuery = query.replace(/\D/g, "");
  if (!cleanQuery) return phone.toLowerCase().includes(query.toLowerCase());
  const strippedQuery = cleanQuery.replace(/^0+/, "");
  return (
    cleanPhone.includes(cleanQuery) ||
    phone.includes(query) ||
    (strippedQuery.length >= 2 && cleanPhone.includes(strippedQuery))
  );
}

export default function NotificationsOpsPage() {
  const [rows, setRows] = useState<OpsNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Filters (NO UUID)
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");

  // User dropdown options
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);

  // Load initial user options for the filter dropdown
  useEffect(() => {
    let active = true;
    fetchTargetOptions("").then((res) => {
      if (active && res.ok) setUserOptions(res.data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function load() {
    setError(null);
    const result = await fetchOpsNotifications({
      userId: selectedUserId || undefined,
      category: category || undefined,
    });
    if (result.ok) {
      setRows(result.data.items);
      setError(null);
    } else {
      setError(result.message);
    }
  }

  function handleReset() {
    setSelectedUserId("");
    setSearchQuery("");
    setCategory("");
    void fetchOpsNotifications().then((res) => {
      if (res.ok) setRows(res.data.items);
    });
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

  // Filter rows locally if a search query is typed (matches user name, phone, email, or title/body)
  const displayRows = useMemo(() => {
    if (!rows) return null;
    let list = rows;

    if (selectedUserId) {
      list = list.filter((r) => r.userId === selectedUserId);
    }

    const q = searchQuery.trim();
    if (q) {
      list = list.filter((r) => {
        const nameMatch = matchesQuery(r.user?.name, q);
        const phoneMatch = matchesPhone(r.user?.phoneNumber, q);
        const titleMatch = matchesQuery(r.title, q);
        const bodyMatch = matchesQuery(r.body, q);
        return nameMatch || phoneMatch || titleMatch || bodyMatch;
      });
    }

    return list;
  }, [rows, selectedUserId, searchQuery]);

  const isFiltered = Boolean(selectedUserId || searchQuery || category);

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
          <span className="text-xs text-[#71808d]">
            {userOptions.find((u) => u.id === params.data?.userId)?.name ?? "مستخدم مسجل"}
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

      {/* Filter Bar (No UUID input: Name/Phone/Email Search + User Dropdown + Category) */}
      <div className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-[#daeaf5] bg-white p-3.5 shadow-sm sm:flex-row sm:items-center">
        {/* User Search Input */}
        <div className="relative flex-1">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
            placeholder="بحث بالاسم، رقم الموبايل، أو البريد الإلكتروني…"
            className="text-xs pe-8"
          />
          <Search className="size-4 absolute left-2.5 top-2.5 text-[#5e6b78] pointer-events-none" />
        </div>

        {/* User Dropdown */}
        <div className="flex items-center gap-1.5 sm:w-64">
          <User className="size-4 text-[#2f719e] shrink-0" />
          <select
            className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2 text-xs outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">كل المستخدمين (المستلم)</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || "مستخدم"} {u.phoneNumber ? `(${u.phoneNumber})` : ""}{" "}
                {u.email ? `— ${u.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Category Dropdown */}
        <select
          className="rounded-xl border border-[#d7e1ea] bg-white p-2 text-xs outline-none focus:border-[#2f719e] sm:w-36"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">كل الفئات</option>
          <option value="TEXT">تنبيه عام</option>
          <option value="TRIP">رحلة</option>
          <option value="DISCOUNT_CODE">كود خصم</option>
        </select>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void load()}>
            بحث
          </Button>
          {isFiltered && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReset}
              className="gap-1 border border-slate-200 text-xs"
              title="إعادة ضبط الفلاتر"
            >
              <RotateCcw className="size-3.5" />
              <span>إعادة ضبط</span>
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!displayRows ? (
        <p className="text-sm text-slate-500">جاري التحميل…</p>
      ) : (
        <AgGridTable<OpsNotification>
          key={displayRows.map((n) => `${n.id}:${n.isRead}`).join("|")}
          gridId="notifications-ops"
          rows={displayRows}
          columnDefs={columns}
          emptyMessage={
            isFiltered
              ? "لا توجد إشعارات مطابقة لمعايير البحث المحددة."
              : "لا توجد إشعارات مسجلة حتى الآن."
          }
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
