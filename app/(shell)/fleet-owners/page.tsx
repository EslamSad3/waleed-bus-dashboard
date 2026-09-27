"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createFleetOwner,
  deleteFleetOwner,
  fetchFleetOwnersPage,
  updateFleetOwner,
  uploadFleetOwnerPicture,
  type FleetOwnerAccount,
} from "@/lib/actions/fleet-owners";
import { createFleet } from "@/lib/actions/fleets";
import { createFleetOwnerSchema } from "@/lib/schemas/p1";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";

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
      <div className="grid gap-4 sm:grid-cols-2">
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
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الإنشاء…" : "إنشاء المالك والأسطول"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** نافذة تعديل بيانات صاحب عربية — نفس شكل الإضافة من غير كلمة السر والأسطول. */
function EditFleetOwnerDialog({ open, owner, onClose }: { open: boolean; owner: FleetOwnerAccount | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // املأ الحقول من المالك المختار — بالنسبة للـ id نفسه مرة واحدة بس
  if (owner && owner.id !== loadedFor) {
    setLoadedFor(owner.id);
    setName(owner.name ?? "");
    setNickname(owner.nickname ?? "");
    setPhone(owner.phoneNumber ?? "");
    setNationalId(owner.nationalId ?? "");
    setIsActive(owner.isActive);
    setImageFile(null);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setImageFile(null);
    setError(null);
  }

  async function submit() {
    if (!owner) return;
    setError(null);
    if (!name.trim()) {
      setError("اكتب الاسم بالكامل.");
      return;
    }
    if (nationalId && !/^\d{14}$/.test(nationalId.trim())) {
      setError("الرقم القومي لازم يكون 14 رقم");
      return;
    }
    setSaving(true);
    const result = await updateFleetOwner(owner.id, {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId: nationalId.trim() || "",
      isActive,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.message);
      return;
    }
    if (imageFile) {
      // الصورة بتترفع كملف FormData — نفس مسار الإضافة.
      const uploaded = await uploadFleetOwnerPicture(owner.id, imageFile, { notify: false });
      if (!uploaded.ok) setError(uploaded.message);
    }
    setSaving(false);
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(owner)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="تعديل بيانات صاحب عربية" description={owner ? `بتعدّل حساب ${owner.name ?? owner.phoneNumber}.` : undefined} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالكامل</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم الشهرة</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">رقم الموبايل</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الرقم القومي (اختياري)</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="14 رقم" autoComplete="off" /></label>
        <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" /> الحساب نشط ويمكنه تسجيل الدخول</label>
        <ImagePicker
          label="صورة المالك (اختياري)"
          file={imageFile}
          onChange={setImageFile}
          uploading={saving && Boolean(imageFile)}
          hint="بتترفع كملف للتخزين السحابي — من غير روابط."
        />
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
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
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الإضافة…" : "إضافة الأسطول"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function FleetOwnersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [fleetOwnerForFleet, setFleetOwnerForFleet] = useState<FleetOwnerAccount | null>(null);
  const [ownerForEdit, setOwnerForEdit] = useState<FleetOwnerAccount | null>(null);
  const [query, setQuery] = useState("");

  const { data: page, isPending, error } = useApiQuery<Page>(qk.fleetOwners, () => fetchFleetOwnersPage(null));

  async function refresh() {
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
  }

  async function removeOwner(owner: FleetOwnerAccount) {
    const fleetsNote = owner.fleets.length > 0 ? ` وملك ${owner.fleets.length} أسطول` : "";
    if (!(await confirm({ title: "تأكيد المسح", description: `الإجراء ده مينفعش يتراجع — تمسح حساب «${owner.name ?? owner.phoneNumber}»${fleetsNote}؟`, confirmLabel: "مسح", destructive: true }))) return;
    const result = await deleteFleetOwner(owner.id);
    if (!result.ok) return;
    await refresh();
  }

  const term = query.trim().toLocaleLowerCase("ar-EG");
  const filter = (owner: FleetOwnerAccount) =>
    !term || [owner.name, owner.nickname, owner.phoneNumber, ...owner.fleets.map((fleet) => fleet.name)]
      .some((value) => value?.toLocaleLowerCase("ar-EG").includes(term));

  const columns: CommunityColumnDef<FleetOwnerAccount>[] = [
    {
      field: "name",
      headerName: "الاسم",
      filter: "agTextColumnFilter",
      cellRenderer: (params: { data?: FleetOwnerAccount }) => params.data ? <span className="font-bold">{params.data.name ?? "بدون اسم"}<span className={params.data.isActive ? "ms-2 status-pill" : "ms-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    { field: "phoneNumber", headerName: "الموبايل", filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { headerName: "الأسطول الأول", filter: false, valueGetter: (params) => params.data?.fleets?.[0]?.name ?? "بدون أسطول" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">أصحاب العربيات</h1>
          <p className="page-description">حساب المالك والأسطول الأول بيتعملوا مع بعض بأمان.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>إضافة مالك</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : isPending ? (
        <TableSkeleton rows={8} columns={4} />
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
          filterBar={<Input aria-label="بحث في أصحاب العربيات" placeholder="الاسم، الموبايل أو الأسطول" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full md:w-auto md:max-w-72 md:min-w-0 md:basis-64 md:flex-1 bg-white" />}
          emptyMessage="لا يوجد أصحاب عربيات بعد"
          renderItem={(owner) => (
            <RowActionsMenu
              label={`إجراءات ${owner.name ?? owner.phoneNumber ?? ""}`}
              actions={[
                { label: "فتح التفاصيل", href: `/fleet-owners/${owner.id}` },
                { label: "تعديل", onSelect: () => setOwnerForEdit(owner) },
                { label: "إضافة أسطول", onSelect: () => setFleetOwnerForFleet(owner) },
                { label: "مسح", danger: true, onSelect: () => void removeOwner(owner) },
              ]}
            />
          )}
        />
      )}
      <CreateFleetOwnerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <AddFleetToOwnerDialog open={Boolean(fleetOwnerForFleet)} owner={fleetOwnerForFleet} onClose={() => setFleetOwnerForFleet(null)} />
      <EditFleetOwnerDialog open={Boolean(ownerForEdit)} owner={ownerForEdit} onClose={() => setOwnerForEdit(null)} />
    </div>
  );
}
