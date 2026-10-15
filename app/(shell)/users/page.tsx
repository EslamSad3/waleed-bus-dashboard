"use client";

import {
  useFieldValidation,
  ValidationMessage,
} from "@/components/ui/field-validation";
import { schemaErrors } from "@/lib/field-validation";
import { createUserSchema, updateUserSchema } from "@/lib/schemas/admin-forms";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { StatusPill } from "@/components/tables/status-column";
import { RowActions } from "@/components/ui/row-actions";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { InlineBlockSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRolesPage } from "@/lib/actions/roles";
import { fetchPlatformSettings, type PlatformSettings } from "@/lib/actions/platform-settings";
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUser,
  fetchAdminUsers,
  setAdminUserRoles,
  updateAdminUser,
  type AccountType,
  type AdminUser,
  type UserListType,
} from "@/lib/actions/users";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { presentRoleName } from "@/lib/role-presentation";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

type Page = { items: AdminUser[]; nextCursor: string | null };

const LIST_TYPES: [UserListType, string][] = [
  ["", t("users.filters.all")],
  ["staff", t("users.filters.staff")],
  ["passenger", t("users.filters.passenger")],
  ["fleet_owner", t("users.filters.fleetOwner")],
  ["driver", t("users.filters.driver")],
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  super_admin: t("users.accountTypes.superAdmin"),
  platform_staff: t("users.accountTypes.platformStaff"),
  fleet_owner: t("users.accountTypes.fleetOwner"),
  driver: t("users.accountTypes.driver"),
  passenger: t("users.accountTypes.passenger"),
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  // Every account by default; type chips and the search box only narrow it.
  const [type, setType] = useState<UserListType>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = { type, q };
  const {
    data: first,
    isLoading,
    error: fetchError,
  } = useApiQuery<Page>([...qk.adminUsers, type, q], () =>
    fetchAdminUsers(null, filters),
  );
  const { data: rolesPage, isPending: rolesPending } = useApiQuery(
    qk.roles,
    () => fetchRolesPage(null),
  );
  const { data: platformSettings, error: settingsError } = useApiQuery<PlatformSettings>(
    qk.platformSettings,
    fetchPlatformSettings,
  );
  const roles = (rolesPage?.items ?? []).filter((role) => role.isActive);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxBookingSeats, setMaxBookingSeats] = useState("");
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);

  function load() {
    // نفضّل الكاش — البيانات تتحدث في الخلفية من غير ما تختفي أو تعيد التحميل
    void queryClient.invalidateQueries({ queryKey: qk.adminUsers });
  }

  function resetForm() {
    validation.reset();
    setPhoneNumber("");
    setSelected(null);
    setName("");
    setEmail("");
    setPassword("");
    setIsActive(true);
    setMaxBookingSeats("");
    setRoleSlugs([]);
    setError(null);
  }

  function toggleRole(slug: string) {
    setRoleSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }

  async function openEdit(user: AdminUser) {
    validation.reset();
    const result = await fetchAdminUser(user.id);
    if (!result.ok) return setError(result.message);
    const current = result.data;
    setPhoneNumber(current.phoneNumber ?? "");
    setSelected(current);
    setName(current.name ?? "");
    setEmail(current.email ?? "");
    setPassword("");
    setIsActive(current.isActive);
    setMaxBookingSeats(
      current.maxBookingSeats ? String(current.maxBookingSeats) : "",
    );
    setRoleSlugs(current.globalRoles?.map((entry) => entry.role.slug) ?? []);
    setError(null);
    setOpen(true);
  }

  const validation = useFieldValidation(() =>
    schemaErrors(
      selected ? updateUserSchema : createUserSchema,
      selected
        ? {
            // Edit: every field is optional — blank keeps the current value
            // (phone: blank clears it; password: blank keeps it).
            name,
            email: email.trim() || undefined,
            phoneNumber: phoneNumber.trim() || null,
            password: password || undefined,
            maxBookingSeats: maxBookingSeats.trim()
              ? Number(maxBookingSeats)
              : null,
          }
        : {
            email: email.trim(),
            phoneNumber: phoneNumber.trim() || undefined,
            password,
            name,
            globalRoleSlugs: roleSlugs,
          },
    ),
  );

  async function save() {
    if (!validation.validate()) return;
    setError(null);
    if (!selected) {
      const result = await createAdminUser({
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
        name: name.trim() || undefined,
        globalRoleSlugs: roleSlugs,
      });
      if (!result.ok) return setError(validation.failure(result));
    } else {
      const limit =
        maxBookingSeats.trim() === "" ? null : Number(maxBookingSeats);
      // Send the email only when filled in and changed (the API re-checks uniqueness).
      const emailChanged =
        email.trim() !== "" &&
        email.trim().toLowerCase() !== (selected.email ?? "").toLowerCase();
      const profile = await updateAdminUser(selected.id, {
        name: name.trim() || undefined,
        ...(emailChanged ? { email: email.trim() } : {}),
        phoneNumber: phoneNumber.trim() || null,
        isActive,
        ...(password ? { password } : {}),
        maxBookingSeats: limit,
      });
      if (!profile.ok) return setError(validation.failure(profile));
      const rolesResult = await setAdminUserRoles(selected.id, roleSlugs);
      if (!rolesResult.ok) return setError(validation.failure(rolesResult));
    }
    setOpen(false);
    resetForm();
    load();
  }

  async function remove(user: AdminUser) {
    if (
      !(await confirm({
        title: t("common.actions.deleteConfirmTitle"),
        description: t("users.deleteConfirm.description", {
          value: user.name || user.email,
        }),
        confirmLabel: t("common.actions.delete"),
        destructive: true,
      }))
    )
      return;
    const result = await deleteAdminUser(user.id);
    if (!result.ok) return setError(result.message);
    setOpen(false);
    resetForm();
    load();
  }
  const userColumns: CommunityColumnDef<AdminUser>[] = [
    {
      field: "name",
      headerName: t("common.fields.name"),
      filter: "agTextColumnFilter",
      valueFormatter: (params) => params.value || t("common.value.withoutName"),
    },
    {
      field: "email",
      headerName: t("common.fields.email"),
      filter: "agTextColumnFilter",
    },
    {
      field: "phoneNumber",
      headerName: t("common.fields.phoneNumber"),
      filter: "agTextColumnFilter",
    },
    {
      colId: "accountTypes",
      headerName: t("users.columns.accountTypes"),
      filter: "agTextColumnFilter",
      valueGetter: (params) =>
        (params.data?.accountTypes ?? [])
          .map((kind) => ACCOUNT_TYPE_LABELS[kind])
          .join(t("common.listSeparator")) || t("users.accountTypes.none"),
    },
    {
      field: "isActive",
      headerName: t("common.fields.status"),
      filter: "agTextColumnFilter",
      cellDataType: "text",
      valueFormatter: (params) =>
        params.value ? t("common.status.active") : t("common.status.inactive"),
      cellRenderer: (params: { value: unknown }) =>
        params.value == null ? null : (
          <StatusPill active={params.value === true} />
        ),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("users.title")}</h1>
          <p className="page-description">{t("users.description")}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> {t("users.newUser")}
        </Button>
      </div>
      {(error || fetchError) && !open ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error ?? fetchError?.message ?? t("common.error.somethingWentWrong")}
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="radiogroup"
          aria-label={t("users.filters.aria")}
          className="flex flex-wrap gap-2"
        >
          {LIST_TYPES.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-bold transition",
                type === value
                  ? "border-[#059ff8] bg-[#eaf6ff] text-[#00134c]"
                  : "border-[#dce6ee] bg-white text-[#5e6b78] hover:text-[#00134c]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("users.filters.searchPlaceholder")}
          aria-label={t("users.filters.searchPlaceholder")}
          className="md:max-w-xs"
        />
      </div>
      {isLoading ? (
        <TableSkeleton rows={8} columns={4} />
      ) : (
        <CursorList<AdminUser>
          key={`${type}|${q}`}
          gridId="admin-users"
          initialItems={first?.items ?? []}
          initialCursor={first?.nextCursor ?? null}
          loadMore={(cursor) =>
            fetchAdminUsers(cursor, filters).then((result) => {
              if (!result.ok) throw new Error(result.message);
              return result.data;
            })
          }
          keyOf={(user) => user.id}
          columnDefs={userColumns}
          emptyMessage={t("users.empty")}
          renderItem={(user) => (
            <RowActions
              label={t("users.list.rowActions", {
                value: user.name || user.email || "",
              })}
              actions={[
                {
                  label: t("common.actions.edit"),
                  icon: Pencil,
                  onSelect: () => void openEdit(user),
                },
                {
                  label: t("common.actions.delete"),
                  icon: Trash2,
                  tone: "danger",
                  onSelect: () => void remove(user),
                },
              ]}
            />
          )}
        />
      )}
      <Dialog
        validation={validation}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
        title={
          selected ? t("users.dialog.editTitle") : t("users.dialog.createTitle")
        }
        description={
          selected
            ? t("users.dialog.editDescription")
            : t("users.dialog.createDescription")
        }
        size="sm"
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">
              {t("common.fields.name")}
              {selected ? (
                <span className="font-normal text-slate-400">
                  {" "}
                  {t("common.value.optional")}
                </span>
              ) : null}
            </span>
            <Input
              fieldName="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("users.placeholders.name")}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">
              {t("common.fields.email")}
              {selected ? (
                <span className="font-normal text-slate-400">
                  {" "}
                  {t("common.value.optional")}
                </span>
              ) : null}
            </span>
            <Input
              fieldName="email"
              dir="ltr"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">
              {t("common.fields.phoneNumber")}{" "}
              <span className="font-normal text-slate-400">
                {t("common.value.optional")}
              </span>
            </span>
            <Input
              fieldName="phoneNumber"
              dir="ltr"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">
              {selected
                ? t("users.dialog.newPasswordLabel")
                : t("users.dialog.fields.password")}
            </span>
            <PasswordInput
              fieldName="password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                selected
                  ? t("users.placeholders.keepPassword")
                  : t("users.placeholders.passwordMin")
              }
            />
          </label>
          {selected ? (
            <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="size-4 accent-[#059ff8]"
              />{" "}
              {t("users.dialog.activeAccount")}
            </label>
          ) : null}
          {selected ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">
                {t("common.fields.maxBookingSeats")}{" "}
                <span className="font-normal text-slate-400">
                  {settingsError ? (
                    <span className="text-red-500">({settingsError.message})</span>
                  ) : platformSettings ? (
                    `${t("users.dialog.emptyUsesDefault")} ${platformSettings.maxSeats})`
                  ) : (
                    `(${t("common.loading.page")})`
                  )}
                </span>
              </span>
              <Input
                fieldName="maxBookingSeats"
                dir="ltr"
                inputMode="numeric"
                type="number"
                min={1}
                value={maxBookingSeats}
                onChange={(event) => setMaxBookingSeats(event.target.value)}
                placeholder={
                  platformSettings
                    ? t("users.dialog.defaultSeatLimit", {
                        PLATFORM_DEFAULT_MAX_BOOKING_SEATS:
                          platformSettings.maxSeats,
                      })
                    : undefined
                }
              />
            </label>
          ) : null}
          {selected?.effectiveMaxBookingSeats != null ? (
            <p className="rounded-xl bg-[#eaf6ff] p-3 text-sm text-[#00134c]">
              {t("users.dialog.effectiveLimit")}{" "}
              {selected.effectiveMaxBookingSeats} {t("users.dialog.seatsUnit")}
            </p>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-[#334454]">
              {t("users.dialog.roles")}
            </legend>
            <div className="grid gap-2 rounded-xl bg-[#f8fbfd] p-3">
              {rolesPending ? (
                <div role="status" className="grid gap-2">
                  <span className="sr-only">{t("common.loading.more")}</span>
                  {Array.from({ length: 3 }, (_, row) => (
                    <div key={row} className="flex items-center gap-2">
                      <Skeleton className="size-4 shrink-0 rounded-md" />
                      <InlineBlockSkeleton className="w-28" />
                    </div>
                  ))}
                </div>
              ) : (
                roles
                  .filter((role) => role.scope === "PLATFORM")
                  .map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={roleSlugs.includes(role.slug)}
                        onChange={() => toggleRole(role.slug)}
                        className="size-4 accent-[#059ff8]"
                      />
                      {presentRoleName(role)}
                    </label>
                  ))
              )}
            </div>
            <ValidationMessage name="roleSlugs" />
            <ValidationMessage name="globalRoleSlugs" />
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <AsyncButton type="button" onClick={save}>
              {t("users.dialog.submit")}
            </AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
