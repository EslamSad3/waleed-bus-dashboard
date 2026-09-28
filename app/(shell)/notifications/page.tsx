"use client";

import { useEffect, useMemo, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { fetchOpsNotifications, type OpsNotification } from "@/lib/actions/notifications";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";
import { SendNotificationDialog } from "@/components/notifications/send-notification-dialog";
import { CheckCircle2, RotateCcw, Search, Send, User } from "lucide-react";
import { qk, useDataQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

const CATEGORY_AR: Record<string, string> = {
  TEXT: t("enums.notificationCategory.alert"),
  TRIP: t("enums.notificationCategory.trip"),
  DISCOUNT_CODE: t("enums.notificationCategory.discountCode"),
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
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Filters (NO UUID)
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");

  // User dropdown options
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);
  const [userOptionsLoading, setUserOptionsLoading] = useState(true);

  // Load initial user options for the filter dropdown
  useEffect(() => {
    let active = true;
    fetchTargetOptions("").then((res) => {
      if (active && res.ok) setUserOptions(res.data);
    }).finally(() => {
      if (active) setUserOptionsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const { data: notifPage, isLoading: rowsLoading } = useDataQuery(
    [...qk.notifications, selectedUserId, category],
    async () => {
      const result = await fetchOpsNotifications({
        userId: selectedUserId || undefined,
        category: category || undefined,
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  );
  const rows: OpsNotification[] | null = notifPage?.items ?? null;

  function load() {
    // إرجاع الـ promise عشان AsyncButton يعرض حالة التحميل ويمنع الضغط المزدوج
    return queryClient.invalidateQueries({ queryKey: qk.notifications });
  }

  function handleReset() {
    setSelectedUserId("");
    setSearchQuery("");
    setCategory("");
    // الفلاتر بترجع للوضع الافتراضي — الكاش بيتحدث تلقائيًا لما المفاتيح تتغير
  }

  function handleSendSuccess(msg?: string) {
    if (msg) {
      setSuccessNote(msg);
      setTimeout(() => setSuccessNote(null), 5000);
    }
    load();
  }

  // Filter rows locally if a search query is typed (matches user name, phone, email, or title/body)
  const filterPredicate = (notification: OpsNotification) => {
    const q = searchQuery.trim();
    if (!q) return true;
    return (
      matchesQuery(notification.user?.name, q) ||
      matchesPhone(notification.user?.phoneNumber, q) ||
      matchesQuery(notification.title, q) ||
      matchesQuery(notification.body, q)
    );
  };

  const isFiltered = Boolean(selectedUserId || searchQuery || category);

  const columns: CommunityColumnDef<OpsNotification>[] = [
    {
      field: "category",
      headerName: t("notifications.columns.category"),
      width: 120,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data ? (
          <span className="status-pill status-pill-muted">
            {CATEGORY_AR[params.data.category] ?? params.data.category}
          </span>
        ) : null,
    },
    { field: "title", headerName: t("common.fields.title"), flex: 1.5 },
    {
      field: "body",
      headerName: t("notifications.columns.body"),
      flex: 2,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data?.body ? (
          <span className="line-clamp-2 text-xs text-[#5e6b78]">{params.data.body}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      headerName: t("notifications.columns.recipient"),
      flex: 1.5,
      cellRenderer: (params: { data?: OpsNotification }) => {
        if (!params.data) return null;
        const user = params.data.user;
        if (user?.name || user?.phoneNumber) {
          return (
            <div className="flex flex-col text-xs leading-tight py-1">
              <span className="font-bold text-[#1a1a1a]">{user.name ?? t("notifications.fallbackUser")}</span>
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
            {userOptions.find((u) => u.id === params.data?.userId)?.name ?? t("notifications.fallbackRegisteredUser")}
          </span>
        );
      },
    },
    {
      field: "isRead",
      headerName: t("common.fields.status"),
      width: 120,
      cellRenderer: (params: { data?: OpsNotification }) =>
        params.data ? (
          <span className={params.data.isRead ? "status-pill status-pill-muted" : "status-pill"}>
            {params.data.isRead ? t("notifications.read") : t("notifications.unread")}
          </span>
        ) : null,
    },
    {
      field: "createdAt",
      headerName: t("common.fields.date"),
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
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("notifications.title")}</h1>
          <p className="page-description">
            {t("notifications.description")}
          </p>
        </div>
        <div className="flex items-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
          <Button
            onClick={() => setSendDialogOpen(true)}
            className="gap-2 bg-[#059ff8] hover:bg-[#00134c]"
          >
            <Send className="size-4" />
            <span>{t("notifications.sendNew")}</span>
          </Button>
          <AsyncButton variant="secondary" onClick={load}>
            {t("notifications.refresh")}
          </AsyncButton>
        </div>
      </div>

      {successNote && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 animate-in fade-in"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span className="min-w-0">{successNote}</span>
        </div>
      )}

      {/* Filter Bar (No UUID input: Name/Phone/Email Search + User Dropdown + Category) */}
      <div className="mb-4 flex flex-col flex-wrap gap-2.5 rounded-2xl border border-[#d6eeff] bg-white p-3.5 shadow-sm md:flex-row md:items-center">
        {/* User Search Input */}
        <div className="relative min-w-0 flex-1 md:max-w-72">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
            placeholder={t("notifications.filters.searchPlaceholder")}
            className="text-xs pe-8"
          />
          <Search className="size-4 absolute end-2.5 top-2.5 text-[#5e6b78] pointer-events-none" />
        </div>

        {/* User Dropdown */}
        <div className="flex items-center gap-1.5 md:w-64">
          <User className="size-4 text-[#059ff8] shrink-0" />
          {userOptionsLoading && userOptions.length === 0 ? (
            <div role="status" className="min-w-0 flex-1">
              <span className="sr-only">{t("common.loading.more")}</span>
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ) : (
            <select
              className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2 text-xs outline-none focus:border-[#059ff8] focus:ring-1 focus:ring-[#059ff8]"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">{t("notifications.filters.allRecipients")}</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || t("notifications.fallbackUser")} {u.phoneNumber ? `(${u.phoneNumber})` : ""}{" "}
                  {u.email ? `— ${u.email}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Category Dropdown */}
        <select
          className="rounded-xl border border-[#d7e1ea] bg-white p-2 text-xs outline-none focus:border-[#059ff8] md:w-36"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">{t("notifications.filters.allCategories")}</option>
          <option value="TEXT">{t("notifications.filters.categoryGeneral")}</option>
          <option value="TRIP">{t("enums.notificationCategory.trip")}</option>
          <option value="DISCOUNT_CODE">{t("enums.notificationCategory.discountCode")}</option>
        </select>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <AsyncButton size="sm" onClick={load}>
            {t("common.actions.search")}
          </AsyncButton>
          {isFiltered && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleReset}
              className="gap-1 border border-slate-200 text-xs"
              title={t("common.actions.resetFilters")}
            >
              <RotateCcw className="size-3.5" />
              <span>{t("common.actions.resetFiltersShort")}</span>
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {rowsLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <CursorList<OpsNotification>
          gridId="notifications-ops"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(notification) => notification.id}
          filter={filterPredicate}
          columnDefs={columns}
          withActions={false}
          emptyMessage={
            isFiltered
              ? t("notifications.emptyFiltered")
              : t("notifications.empty")
          }
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
