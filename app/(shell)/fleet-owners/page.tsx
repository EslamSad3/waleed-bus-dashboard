"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  createFleetOwner,
  fetchFleetOwnersPage,
  uploadFleetOwnerPicture,
  type FleetOwnerAccount,
} from "@/lib/actions/fleet-owners";
import { createFleet } from "@/lib/actions/fleets";
import { createFleetOwnerSchema } from "@/lib/schemas/p1";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";

type Page = { items: FleetOwnerAccount[]; nextCursor: string | null };

/** نافذة إضافة صاحب عربية — الصورة بتترفع كملف (FormData) مش لينك. */
function CreateFleetOwnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [fleetName, setFleetName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName(""); setNickname(""); setPhone(""); setNationalId(""); setFleetName("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    const parsed = createFleetOwnerSchema.safeParse({
      name, nickname, phone, fleetName,
      password,
      nationalId: nationalId || undefined,
      picture: undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "أكمل البيانات المطلوبة.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("كلمتا السر غير متطابقتين");
      return;
    }
    setSaving(true);
    const result = await createFleetOwner({
      name: name.trim(),
      nickname: nickname.trim(),
      phone,
      password,
      fleetName: fleetName.trim(),
      nationalId: nationalId || undefined,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.message);
      return;
    }
    // الصورة بتترفع كملف FormData بعد إنشاء الحساب — مش لينك مكتوب بالإيد.
    if (imageFile) {
      // The create toast already fired — the picture step stays silent.
      const uploaded = await uploadFleetOwnerPicture(result.data.id, imageFile, { notify: false });
      if (!uploaded.ok) setError(uploaded.message);
    }
    setSaving(false);
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="إضافة صاحب عربية" description="هننشئ الحساب والأسطول الأول وعضوية المالك في خطوة واحدة." size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالكامل</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="أحمد حسن" autoComplete="name" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم الشهرة</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="أحمد" autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">رقم الموبايل</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الرقم القومي (اختياري)</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="14 رقم" autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم الأسطول</span><Input value={fleetName} onChange={(event) => setFleetName(event.target.value)} placeholder="نقل أحمد" autoComplete="organization" /></label>
        <ImagePicker
          label="صورة المالك (اختياري)"
          file={imageFile}
          onChange={setImageFile}
          uploading={saving && Boolean(imageFile)}
          hint="بتترفع كملف للتخزين السحابي — من غير روابط."
        />
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">كلمة السر</span><Input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">تأكيد كلمة السر</span><Input dir="ltr" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" /></label>
        {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4 md:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الإنشاء…" : "إنشاء المالك والأسطول"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** نافذة إضافة أسطول لصاحب عربية موجود (issue 13). */
function AddFleetToOwnerDialog({ open, owner, onClose }: { open: boolean; owner: FleetOwnerAccount | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fleetName, setFleetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFleetName("");
    setError(null);
  }

  async function submit() {
    if (!owner) return;
    setError(null);
    if (!fleetName.trim()) {
      setError("اكتب اسم الأسطول.");
      return;
    }
    setSaving(true);
    const result = await createFleet({ name: fleetName.trim(), ownerId: owner.id, ownerRoleSlug: "fleet-owner" });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(owner)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="إضافة أسطول لصاحب عربية" description={owner ? `هنضيف أسطول جديد ملكه ${owner.name} — الدور الابتدائي ثابت fleet-owner.` : undefined} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">اسم الأسطول</span>
          <Input value={fleetName} onChange={(event) => setFleetName(event.target.value)} placeholder="أسطول الجيزة" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الإضافة…" : "إضافة الأسطول"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function FleetOwnersPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [fleetOwnerForFleet, setFleetOwnerForFleet] = useState<FleetOwnerAccount | null>(null);
  const [query, setQuery] = useState("");

  const { data: page, isLoading, error } = useApiQuery<Page>(qk.fleetOwners, () => fetchFleetOwnersPage(null));

  const term = query.trim().toLocaleLowerCase("ar-EG");
  const filter = (owner: FleetOwnerAccount) =>
    !term || [owner.name, owner.nickname, owner.phoneNumber, ...owner.fleets.map((fleet) => fleet.name)]
      .some((value) => value?.toLocaleLowerCase("ar-EG").includes(term));

  const columns: CommunityColumnDef<FleetOwnerAccount>[] = [
    {
      field: "name",
      headerName: "الاسم",
      filter: "agTextColumnFilter",
      cellRenderer: (params: { data?: FleetOwnerAccount }) => params.data ? <span className="font-bold">{params.data.name ?? "بدون اسم"}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    { field: "phoneNumber", headerName: "الموبايل", filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { headerName: "الأسطول الأول", filter: false, valueGetter: (params) => params.data?.fleets?.[0]?.name ?? "بدون أسطول" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">أصحاب العربيات</h1>
          <p className="page-description">حساب المالك والأسطول الأول بيتعملوا مع بعض بأمان.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>إضافة مالك</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : isLoading ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<FleetOwnerAccount>
          gridId="fleet-owners"
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={(cursor) => fetchFleetOwnersPage(cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(owner) => owner.id}
          filter={filter}
          columnDefs={columns}
          filterBar={<Input aria-label="بحث في أصحاب العربيات" placeholder="الاسم، الموبايل أو الأسطول" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-sm bg-white" />}
          emptyMessage="لا يوجد أصحاب عربيات بعد"
          renderItem={(owner) => (
            <RowActionsMenu
              label={`إجراءات ${owner.name ?? owner.phoneNumber ?? ""}`}
              actions={[
                { label: "فتح التفاصيل", href: `/fleet-owners/${owner.id}` },
                { label: "إضافة أسطول", onSelect: () => setFleetOwnerForFleet(owner) },
              ]}
            />
          )}
        />
      )}
      <CreateFleetOwnerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <AddFleetToOwnerDialog open={Boolean(fleetOwnerForFleet)} owner={fleetOwnerForFleet} onClose={() => setFleetOwnerForFleet(null)} />
    </div>
  );
}
