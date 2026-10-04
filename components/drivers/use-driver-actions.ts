"use client";

import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { RowAction } from "@/components/ui/row-actions";
import { deleteDriverAccount, updateDriver, type DriverRow } from "@/lib/actions/members";
import { applyMutationCache, driverImpact } from "@/lib/cache/mutations";
import { useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export function useDriverActions() {
  const confirm = useConfirm();
  const client = useQueryClient();
  return (driver: DriverRow, ownerId: string, onSaved?: (fresh: DriverRow) => void, onDeleted?: () => void): RowAction[] => {
    const userId = driver.userId ?? driver.id;
    const active = driver.status === "ACTIVE";
    return [
      {
        label: active ? t("drivers.lifecycle.deactivate") : t("drivers.lifecycle.reactivate"),
        icon: active ? Ban : CheckCircle2,
        tone: active ? "warning" : "success",
        onSelect: async () => {
          if (!(await confirm({ title: t("common.actions.confirmAction"),
            description: active ? t("drivers.lifecycle.deactivateDescription") : t("drivers.lifecycle.reactivateDescription"),
            confirmLabel: active ? t("drivers.lifecycle.deactivate") : t("drivers.lifecycle.reactivate"), destructive: active }))) return;
          const result = await updateDriver(ownerId, userId, { status: active ? "SUSPENDED" : "ACTIVE" });
          if (!result.ok) return;
          applyMutationCache(client, driverImpact({ driver: { id: driver.id, ownerId, userId }, mode: "update" }), result);
          onSaved?.(result.data);
        },
      },
      {
        label: t("common.actions.delete"), icon: Trash2, tone: "danger",
        onSelect: async () => {
          if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("drivers.lifecycle.deleteDescription"),
            confirmLabel: t("common.actions.delete"), destructive: true }))) return;
          const result = await deleteDriverAccount(userId);
          if (!result.ok) return;
          applyMutationCache(client, driverImpact({ driver: { id: driver.id, ownerId, userId }, mode: "remove" }), result);
          // Other memberships for this user disappear too; their queries refetch.
          onDeleted?.();
        },
      },
    ];
  };
}
