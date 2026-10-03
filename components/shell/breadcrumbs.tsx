"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { t } from "@/lib/i18n/t";

/**
 * Shared breadcrumb trail mounted once in the shell layout, above the page
 * content. It depends only on the route (never on page data), so it stays
 * visible during loading, empty states, and errors. Ancestors are links, the
 * current page carries `aria-current="page"`, separators are aria-hidden for
 * RTL, and the list wraps on narrow phones.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trail = buildBreadcrumbs(pathname ?? "/", searchParams);

  return (
    <nav aria-label={t("breadcrumbs.aria")} className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          const label = t(entry.labelKey);
          return (
            <Fragment key={`${entry.labelKey}-${index}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="select-none text-[#919191]">
                  /
                </li>
              ) : null}
              <li className="min-w-0">
                {isLast || !entry.href ? (
                  <span aria-current="page" className="font-bold text-[#00134c]">
                    {label}
                  </span>
                ) : (
                  <Link
                    href={entry.href}
                    className="font-medium text-[#2f719e] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/25"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
