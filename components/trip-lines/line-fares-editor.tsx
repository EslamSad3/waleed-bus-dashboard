"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";
import { schemaErrors } from "@/lib/field-validation";
import * as schemas from "@/lib/schemas/p1";
import { saveLineFares, type FareTable } from "@/lib/actions/trip-lines";
import { fareKey, faresPayload } from "@/lib/line-fares";
import { useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { FareMatrix } from "./fare-matrix";

const pricesOf = (table: FareTable) => Object.fromEntries(table.fares.map(f => [fareKey(f), f.unitFare ?? ""]));

/**
 * Edits every boarding → landing price on the line at once. One save sends the
 * whole table with the revision it was loaded at, so a concurrent edit is
 * rejected (PRICING_REVISION_CONFLICT) instead of silently overwritten.
 */
export function LineFaresEditor({ ownerId, lineId, table, onReload }: {
  ownerId: string; lineId: string; table: FareTable; onReload: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [loaded, setLoaded] = useState(table);
  const [original, setOriginal] = useState(() => pricesOf(table));
  const [prices, setPrices] = useState(original);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  // Adopt a refreshed table (refetch after save elsewhere) only when nothing is being edited.
  const dirtyCount = loaded.pairs.filter(p => (prices[fareKey(p)] ?? "") !== (original[fareKey(p)] ?? "")).length;
  if (table !== loaded && dirtyCount === 0) {
    const values = pricesOf(table);
    setLoaded(table); setOriginal(values); setPrices(values); setConflict(false); setError(null);
  }

  const payload = { expectedPricingRevision: loaded.pricingRevision, fares: faresPayload(loaded.pairs, prices) };
  const validation = useFieldValidation(() => schemaErrors(schemas.saveLineFaresSchema, payload));

  async function save() {
    setError(null);
    if (!validation.validate()) return;
    const result = await saveLineFares(ownerId, lineId, payload, { notify: false });
    if (!result.ok) {
      if (result.code === "PRICING_REVISION_CONFLICT") setConflict(true);
      return setError(validation.failure(result));
    }
    const values = pricesOf(result.data);
    setLoaded(result.data); setOriginal(values); setPrices(values);
    validation.reset();
    void queryClient.invalidateQueries();
    toast.success(t("pricing.saved"));
  }

  function discard() {
    setPrices(original); setError(null); validation.reset();
  }

  return <ValidationScope validation={validation}>
    <div className="space-y-2">
      <FareMatrix pairs={loaded.pairs} prices={prices} onChange={setPrices} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#cfe1ec] bg-[#f8fbfd] px-4 py-3">
        <div className="min-w-0 flex-1 text-sm">
          {error ? <p role="alert" className="text-destructive">{error}</p>
            : <p className="text-[#687886]">{dirtyCount ? t("pricing.unsaved", { count: dirtyCount }) : t("pricing.saveAllHint")}</p>}
          {loaded.lastUpdated ? <p className="mt-1 text-xs text-slate-500">{t("pricing.lastUpdated")} {new Date(loaded.lastUpdated).toLocaleString("ar-EG")}</p> : null}
        </div>
        <div className="flex flex-1 gap-2 sm:flex-none">
          {conflict
            ? <AsyncButton type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={async () => { setPrices(original); await onReload(); }}><RotateCcw className="size-4" />{t("pricing.refresh")}</AsyncButton>
            : <Button type="button" variant="secondary" className="flex-1 sm:flex-none" disabled={!dirtyCount} onClick={discard}><RotateCcw className="size-4" />{t("pricing.discard")}</Button>}
          <AsyncButton type="button" className="flex-1 sm:flex-none" disabled={!dirtyCount || conflict} onClick={save}><Save className="size-4" />{t("pricing.saveAll")}</AsyncButton>
        </div>
      </div>
    </div>
  </ValidationScope>;
}
