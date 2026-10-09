"use client";
import { ArrowLeft, CheckCircle2, Coins, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/t";
import { fareKey, type FarePair } from "@/lib/line-fares";

const validPrice = (value: string | undefined) => /^\d{1,8}(?:\.\d{1,2})?$/.test(value ?? "") && Number(value) > 0;

/**
 * Prices grouped by boarding station: every row reads "from → to" next to its
 * own price, so a sparse line (one or two pairs) stays as readable as a long one.
 */
export function FareMatrix({ pairs, prices, onChange, readOnly = false }: {
  pairs: FarePair[]; prices: Record<string, string>; onChange?: (prices: Record<string, string>) => void; readOnly?: boolean;
}) {
  const current = pairs.filter(p => p.scope !== "FROZEN_TRIP");
  const retained = pairs.filter(p => p.scope === "FROZEN_TRIP");
  const groups = [...new Map(current.map(p => [p.boardingStationId, p.boardingStationName ?? ""])).entries()]
    .map(([id, name]) => ({ id, name, pairs: current.filter(p => p.boardingStationId === id) }));
  const filled = pairs.filter(p => validPrice(prices[fareKey(p)])).length;
  const complete = filled === pairs.length && filled > 0;

  function price(pair: FarePair) {
    const key = fareKey(pair), index = pairs.findIndex(p => fareKey(p) === key);
    if (readOnly) {
      return prices[key]
        ? <span dir="ltr" className="font-bold tabular-nums text-[#00134c]">{prices[key]} <span className="text-xs font-semibold text-[#687886]">{t("pricing.currencyLabel")}</span></span>
        : <span className="text-sm font-semibold text-amber-700">{t("pricing.notSet")}</span>;
    }
    return <div dir="ltr" className="relative w-full sm:w-44">
      <Input
        fieldName={`fares.${index}.unitFare`} aria-label={t("pricing.pairLabel", { boarding: pair.boardingStationName ?? "", landing: pair.landingStationName ?? "" })}
        inputMode="decimal" value={prices[key] ?? ""} placeholder="0.00"
        onChange={event => onChange?.({ ...prices, [key]: event.target.value })}
        className="pe-12 font-bold tabular-nums text-[#00134c]" />
      <span className="pointer-events-none absolute end-3.5 top-[22px] -translate-y-1/2 text-xs font-bold text-[#687886]">{t("pricing.currencyLabel")}</span>
    </div>;
  }

  function row(pair: FarePair, showBoarding = false) {
    const set = validPrice(prices[fareKey(pair)]);
    return <li key={fareKey(pair)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-2 pt-2.5 text-sm">
        <span className={`size-2 shrink-0 rounded-full ${set ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden />
        {showBoarding ? <><span className="font-semibold text-[#334454]">{pair.boardingStationName}</span><ArrowLeft className="size-4 shrink-0 text-[#8b98a5]" aria-hidden /></> : <span className="text-[#687886]">{t("pricing.landingAt")}</span>}
        <span className="font-bold text-[#17212b]">{pair.landingStationName}</span>
      </div>
      {price(pair)}
    </li>;
  }

  return <section className="overflow-hidden rounded-2xl border border-[#cfe1ec] bg-white">
    <div className="flex flex-col gap-3 border-b border-[#e4ecf2] bg-[#f8fbfd] p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e3f1fc] text-[#00134c]"><Coins className="size-5" /></span>
        <div><h3 className="font-extrabold text-[#00134c]">{t("pricing.title")}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-[#687886]">{t("pricing.hint")}</p></div>
      </div>
      <span role="status" className={`flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-bold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
        {complete ? <CheckCircle2 className="size-3.5" /> : null}{t("pricing.progress", { filled, total: pairs.length })}
      </span>
    </div>
    <div className="h-1 bg-slate-100" role="progressbar" aria-label={t("pricing.title")} aria-valuenow={filled} aria-valuemin={0} aria-valuemax={Math.max(1, pairs.length)}>
      <div className="h-full bg-[#059ff8] transition-[width]" style={{ width: `${pairs.length ? filled / pairs.length * 100 : 0}%` }} />
    </div>
    <div className="space-y-3 p-4">
      {!pairs.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{t("pricing.noPairs")}</p> : null}
      {groups.map(group => <div key={group.id} className="overflow-hidden rounded-xl border border-[#e4ecf2]">
        <div className="flex items-center gap-2 bg-[#f8fbfd] px-4 py-2.5 text-sm">
          <MapPin className="size-4 text-[#059ff8]" aria-hidden />
          <span className="text-[#687886]">{t("pricing.boardingFrom")}</span>
          <span className="font-extrabold text-[#00134c]">{group.name}</span>
        </div>
        <ul className="divide-y divide-[#eef3f7]">{group.pairs.map(p => row(p))}</ul>
      </div>)}
      {!!retained.length && <div className="overflow-hidden rounded-xl border border-amber-200">
        <p className="bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800">{t("pricing.retained")}</p>
        <ul className="divide-y divide-[#eef3f7]">{retained.map(p => row(p, true))}</ul>
      </div>}
    </div>
  </section>;
}
