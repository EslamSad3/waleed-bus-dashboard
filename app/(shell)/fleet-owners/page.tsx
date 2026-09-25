"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchFleetOwnersPage, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";

export default function FleetOwnersPage() {
  const [page, setPage] = useState<{ items: FleetOwnerAccount[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchFleetOwnersPage(null).then((result) => {
      if (result.ok) { setPage(result.data); setFailed(null); }
      else setFailed(result.message);
    });
  }, []);

  const term = query.trim().toLocaleLowerCase("ar-EG");
  const filter = (owner: FleetOwnerAccount) =>
    !term || [owner.name, owner.nickname, owner.phoneNumber, ...owner.fleets.map((fleet) => fleet.name)]
      .some((value) => value?.toLocaleLowerCase("ar-EG").includes(term));

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">ملاك الأساطيل</h1>
          <p className="page-description">حساب المالك والأسطول الأول بيتعملوا مع بعض بأمان.</p>
        </div>
        <Button asChild><Link href="/fleet-owners/new">إضافة مالك</Link></Button>
      </div>

      {failed ? <p role="alert" className="text-sm text-red-600">{failed}</p> : !page ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={(cursor) => fetchFleetOwnersPage(cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(owner) => owner.id}
          filter={filter}
          filterBar={<Input aria-label="بحث في ملاك الأساطيل" placeholder="الاسم، الموبايل أو الأسطول" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-sm bg-white" />}
          emptyMessage="لا يوجد ملاك أساطيل بعد"
          renderItem={(owner) => (
            <Link href={`/fleet-owners/${owner.id}`} className="list-card">
              <span>
                <span className="block font-semibold">{owner.name}</span>
                <span className="text-sm text-[#606060]" dir="ltr">{owner.phoneNumber}</span>
              </span>
              <span className="text-right text-sm text-[#5e6b78] sm:text-left">
                <span className="block font-medium text-[#1a1a1a]">{owner.fleets[0]?.name ?? "بدون أسطول"}</span>
                <span className={owner.isActive ? "status-pill mt-1" : "status-pill status-pill-muted mt-1"}>
                  {owner.isActive ? "نشط" : "موقوف"}
                </span>
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
