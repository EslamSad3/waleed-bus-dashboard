"use client";

import { useMemo, useState } from "react";
import { useApiQuery, qk } from "@/lib/queries";
import { fetchFleetOwnersPage, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { t } from "@/lib/i18n/t";

/**
 * Owner picker. An owner user IS the company, so there is no second level to
 * pick — one dropdown replaces the old owner → company pair.
 */
export function OwnerPicker({
  ownerId,
  onOwnerChange,
  label,
  placeholder,
  allowEmpty = true,
}: {
  ownerId: string;
  onOwnerChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null));

  const options = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows: FleetOwnerAccount[] = data?.items ?? [];
    const matched = needle
      ? rows.filter(
          (owner) =>
            (owner.name ?? "").toLowerCase().includes(needle) ||
            (owner.phoneNumber ?? "").includes(needle),
        )
      : rows;
    return matched.map((owner) => ({
      id: owner.id,
      label: owner.name || owner.nickname || owner.phoneNumber || owner.id,
    }));
  }, [data, search]);

  return (
    <div className="mb-1.5">
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">
          {label ?? t("fleetOwnerPicker.label")}
        </span>
        <input
          type="search"
          className="input-field mb-2 w-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("fleetOwnerPicker.searchPlaceholder")}
          aria-label={t("fleetOwnerPicker.searchAria")}
        />
        <select
          className="select-field w-full"
          value={ownerId}
          onChange={(event) => onOwnerChange(event.target.value)}
          aria-label={label ?? t("fleetOwnerPicker.label")}
        >
          {allowEmpty ? <option value="">{placeholder ?? t("fleetOwnerPicker.placeholder")}</option> : null}
          {isLoading ? <option value="">{t("common.loading.page")}</option> : null}
          {error ? <option value="">{error.message}</option> : null}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
