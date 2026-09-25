"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createPromotion,
  expirePromotion,
  fetchPromotions,
  fetchPromotionUsages,
  updatePromotion,
  type Promotion,
  type PromotionUsage,
} from "@/lib/actions/promotions";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";

export default function PromotionsPage() {
  const [rows, setRows] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [usagesFor, setUsagesFor] = useState<Promotion | null>(null);
  const [usages, setUsages] = useState<PromotionUsage[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [audience, setAudience] = useState<"all" | "specific">("all");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [maxPerUser, setMaxPerUser] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetchPromotions().then((result) => {
      if (result.ok) setRows(result.data.items);
      else setError(result.message);
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setCode("");
    setValue("");
    setAudience("all");
    setTargetIds([]);
    setUserSearch("");
    setMaxTotal("");
    setMaxPerUser("1");
    setExpiresAt("");
    setError(null);
    setCreating(true);
  }

  function openEdit(promo: Promotion) {
    setCreating(false);
    setEditing(promo);
    setValue(promo.value);
    setAudience(promo.isGlobal ? "all" : "specific");
    setTargetIds(promo.targetUserIds ?? []);
    setUserSearch("");
    setMaxTotal(promo.maxTotalUses != null ? String(promo.maxTotalUses) : "");
    setMaxPerUser(String(promo.maxUsesPerUser));
    setExpiresAt(promo.expiresAt ? promo.expiresAt.slice(0, 16) : "");
    setError(null);
  }

  async function save() {
    const numValue = Number(value);
    if (!editing && !code.trim()) {
      setError("أدخل كود الخصم.");
      return;
    }
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setError("أدخل قيمة صحيحة أكبر من صفر.");
      return;
    }
    const specific = editing ? !editing.isGlobal : audience === "specific";
    if (specific && targetIds.length === 0) {
      setError("اختر مستخدمًا واحدًا على الأقل للكود المخصص.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updatePromotion(editing.id, {
          value: numValue,
          ...(!editing.isGlobal ? { targetUserIds: targetIds } : {}),
          maxUsesPerUser: Number(maxPerUser) || 1,
          maxTotalUses: maxTotal ? Number(maxTotal) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        })
      : await createPromotion({
          code: code.trim(),
          type: "FIXED",
          value: numValue,
          isGlobal: audience === "all",
          ...(audience === "specific" ? { targetUserIds: targetIds } : {}),
          maxUsesPerUser: Number(maxPerUser) || 1,
          maxTotalUses: maxTotal ? Number(maxTotal) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    if (editing) {
      setRows((items) => items?.map((p) => (p.id === result.data.id ? result.data : p)) ?? [result.data]);
      setEditing(null);
    } else {
      setRows((items) => [result.data, ...(items ?? [])]);
      setCreating(false);
    }
    setError(null);
  }

  async function expire(promo: Promotion) {
    const result = await expirePromotion(promo.id);
    if (!result.ok) return setError(result.message);
    setRows((items) => items?.map((p) => (p.id === result.data.id ? result.data : p)) ?? []);
  }

  async function openUsages(promo: Promotion) {
    setUsagesFor(promo);
    setUsages(null);
    const result = await fetchPromotionUsages(promo.id);
    if (result.ok) setUsages(result.data.items);
    else setError(result.message);
  }

  const dialogOpen = creating || editing !== null;

  useEffect(() => {
    if (!dialogOpen) return;
    // Server-side search over ALL eligible accounts (debounced); the list is
    // already scoped to active passengers by GET /users/target-options.
    const timer = setTimeout(() => {
      fetchTargetOptions(userSearch).then((result) => {
        if (result.ok) setUserOptions(result.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [dialogOpen, userSearch]);

  const columns: CommunityColumnDef<Promotion>[] = [
    {
      field: "code",
      headerName: "الكود",
      cellRenderer: (params: { data?: Promotion }) => params.data ? <span dir="ltr" className="font-mono font-bold">{params.data.code}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    {
      field: "type",
      headerName: "النوع",
      cellRenderer: (params: { data?: Promotion }) => params.data ? <span>{params.data.value} جنيه (ثابت)</span> : null,
    },
    { field: "maxUsesPerUser", headerName: "مرات/مستخدم", filter: "agNumberColumnFilter" },
    {
      field: "isGlobal",
      headerName: "النطاق",
      cellRenderer: (params: { data?: Promotion }) => params.data ? (
        <span>{params.data.isGlobal ? "عام — كل المستخدمين" : `مخصص (${params.data.targetUserIds?.length ?? 0})`}</span>
      ) : null,
    },
    {
      field: "maxTotalUses",
      headerName: "السقف الكلي",
      cellRenderer: (params: { data?: Promotion }) => <span>{params.data?.maxTotalUses ?? "∞"}</span>,
    },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: Promotion }) => {
        const promo = params.data;
        if (!promo) return null;
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(promo)}><Pencil className="size-4" /> تعديل</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void openUsages(promo)}>الاستخدام</Button>
            {promo.isActive ? <Button type="button" size="sm" variant="secondary" onClick={() => void expire(promo)}>إيقاف</Button> : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">أكواد الخصم</h1>
          <p className="page-description">أكواد عامة لكل المستخدمين أو مخصصة لمستخدمين محددين (مرة واحدة لكل مستخدم افتراضيًا) — تُطبق عند الحجز، والمخصص يُشعر مستخدميه تلقائيًا.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> كود جديد</Button>
      </div>
      {error && !dialogOpen && !usagesFor ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Promotion>
          key={rows.map((p) => `${p.id}:${p.isActive}`).join("|")}
          gridId="promotions"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد أكواد بعد — ابدأ بإضافة كود عام."
          getRowId={(p) => p.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? `تعديل ${editing.code}` : "كود جديد"} description={editing ? "الكود نفسه لا يتغير بعد الإنشاء." : "الكود يتحول لحروف كبيرة تلقائيًا (A-Z 0-9 _ -)."} size="sm">
        <div className="space-y-4">
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الكود</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="SAVE10" /></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">القيمة — مبلغ ثابت بالجنيه</span><Input dir="ltr" inputMode="decimal" type="number" min={1} value={value} onChange={(event) => setValue(event.target.value)} placeholder="مثال: 50" /></label>
          {!editing || !editing.isGlobal ? (
            <div className="space-y-2 text-sm">
              <span className="block font-bold text-[#334454]">الجمهور {editing ? "(النطاق لا يتغير بعد الإنشاء)" : ""}</span>
              {!editing ? (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="radio" checked={audience === "all"} onChange={() => setAudience("all")} className="size-4 accent-[#2f719e]" /> كل المستخدمين</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={audience === "specific"} onChange={() => setAudience("specific")} className="size-4 accent-[#2f719e]" /> مستخدمون محددون</label>
                </div>
              ) : null}
              {(editing ? !editing.isGlobal : audience === "specific") ? (
                <div className="rounded-xl border border-[#e4ecf2] p-3">
                  <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="ابحث بالاسم أو الهاتف أو البريد…" />
                  <p className="mt-1 text-xs text-slate-500">البحث يشمل كل حسابات الركاب النشطة. المستخدمون الجدد المضافون يستلمون إشعار كود الخصم تلقائيًا.</p>
                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                    {userOptions
                      .map((u) => (
                        <label key={u.id} className="flex items-center gap-2 rounded-lg bg-[#f8fbfd] p-2">
                          <input
                            type="checkbox"
                            checked={targetIds.includes(u.id)}
                            onChange={(event) =>
                              setTargetIds((ids) => (event.target.checked ? [...ids, u.id] : ids.filter((id) => id !== u.id)))
                            }
                            className="size-4 accent-[#2f719e]"
                          />
                          <span className="font-bold">{u.name ?? "بدون اسم"}</span>
                          <span dir="ltr" className="text-xs text-slate-500">{u.phoneNumber ?? ""}</span>
                        </label>
                      ))}
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#2f719e]">المحدد: {targetIds.length}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">مرات الاستخدام لكل مستخدم (1 = مرة واحدة)</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxPerUser} onChange={(event) => setMaxPerUser(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">السقف الكلي (فارغ = بلا حد)</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxTotal} onChange={(event) => setMaxTotal(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">تاريخ الانتهاء (فارغ = بلا انتهاء)</span><Input dir="ltr" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button></div>
        </div>
      </Dialog>
      <Dialog open={usagesFor !== null} onOpenChange={(open) => { if (!open) setUsagesFor(null); }} title={usagesFor ? `استخدام ${usagesFor.code}` : "الاستخدام"} description="كل صف = حجز استهلك الكود." size="sm">
        <div className="space-y-2 text-sm">
          {!usages ? <p className="text-slate-500">جاري التحميل…</p> : usages.length === 0 ? <p className="text-slate-500">لم يُستخدم بعد.</p> : usages.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-[#f8fbfd] p-3">
              <span dir="ltr" className="font-mono text-xs text-slate-500">{u.bookingId.slice(0, 8)}…</span>
              <span className="font-bold">{u.discountAmount} جنيه</span>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
