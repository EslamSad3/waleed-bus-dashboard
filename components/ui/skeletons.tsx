import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n/t";

/**
 * Composed loading skeletons matching the dashboard's real layout blocks
 * (page heading, ag-grid shell, panel cards, form grids). Pick the shape that
 * mirrors the page's loaded state so loading → data doesn't shift layout.
 * All primitives are light-theme only and RTL-safe (logical properties only).
 */

/**
 * Collapse classes per desktop column count. Literal strings so Tailwind's
 * scanner sees them; base is always a single column (360px-first).
 */
const GRID_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
} as const;

export type SkeletonGridColumns = keyof typeof GRID_COLUMNS;

/** Announced once per skeleton root; the decorative bars themselves carry no text. */
function LoadingStatus() {
  return <span className="sr-only">{t("common.loading.more")}</span>;
}

export type TableSkeletonProps = {
  /** Body rows to draw (default 8). */
  rows?: number;
  /** Header/body columns (default 5). */
  columns?: number;
  className?: string;
};

const CELL_WIDTHS = ["w-[92%]", "w-[70%]", "w-[85%]", "w-[60%]", "w-[78%]", "w-[90%]"] as const;

/**
 * Skeleton for ag-grid list pages (CursorList / AgGridTable): toolbar row,
 * header row, then body rows. Reuses the .ag-grid-* shells and AgGridTable's
 * height formula so nothing jumps when the grid lands.
 */
export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  // Mirrors AgGridTable: Math.min(560, Math.max(240, 144 + rows * 48)).
  const viewportHeight = Math.min(560, Math.max(240, 144 + rows * 48));
  return (
    <div role="status" dir="rtl" className={cn("ag-grid-shell", className)}>
      <LoadingStatus />
      <div className="ag-grid-toolbar">
        <Skeleton className="h-[2.6rem] w-full md:w-auto md:max-w-72 md:min-w-0 md:basis-64 md:flex-1" />
        <Skeleton className="ms-auto h-4 w-14 max-md:hidden" />
        <Skeleton className="h-[2.6rem] w-full md:w-28" />
      </div>
      <div className="ag-grid-frame" style={{ height: `${viewportHeight}px` }}>
        <div className="grid gap-3 border-b border-[#e4ecf2] bg-[#f5f9fc] px-4 py-4">
          <div className="grid items-center gap-3" style={{ gridTemplateColumns }}>
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className="h-4 rounded-md" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid items-center gap-3 border-b border-[#e4ecf2] px-4 py-4 last:border-b-0"
            style={{ gridTemplateColumns }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={`h-4 ${CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export type CardsGridSkeletonProps = {
  /** Cards to draw (default 6). */
  count?: number;
  /** Desktop column count → collapse classes (default 3). */
  columns?: SkeletonGridColumns;
  className?: string;
};

/**
 * Skeleton for sections that load into panel-card grids (module cards,
 * list cards, notification cards). Single column on phones, 2 at sm,
 * `columns` from the listed breakpoint up.
 */
export function CardsGridSkeleton({ count = 6, columns = 3, className }: CardsGridSkeletonProps) {
  return (
    <div
      role="status"
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4", GRID_COLUMNS[columns], className)}
    >
      <LoadingStatus />
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="panel-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-2xl" />
            <Skeleton className="h-5 w-28 max-w-full" />
          </div>
          <Skeleton className="mt-4 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-2/3" />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type KpiCardsSkeletonProps = {
  /** Cards to draw (default 4). */
  count?: number;
  /** Desktop column count → collapse classes (default 4). */
  columns?: SkeletonGridColumns;
  className?: string;
};

/** Skeleton for KPI/stat rows (mirrors the home KpiCard: icon + label + value). */
export function KpiCardsSkeleton({ count = 4, columns = 4, className }: KpiCardsSkeletonProps) {
  return (
    <div
      role="status"
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4", GRID_COLUMNS[columns], className)}
    >
      <LoadingStatus />
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="panel-card flex min-w-0 items-center gap-3 p-4 sm:gap-4 sm:p-5">
          <Skeleton className="size-11 shrink-0 rounded-2xl sm:size-12" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24 max-w-full" />
            <Skeleton className="h-5 w-14 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type DetailPageSkeletonProps = {
  /** Two-column panel sections under the heading (default 2). */
  sections?: number;
  className?: string;
};

/**
 * Skeleton for detail pages: page heading (title + description + full-width
 * action on phones) followed by panel-card sections in the standard
 * lg:grid-cols-2 layout.
 */
export function DetailPageSkeleton({ sections = 2, className }: DetailPageSkeletonProps) {
  return (
    <div role="status" className={cn("dashboard-page", className)}>
      <LoadingStatus />
      <div className="page-heading">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-9 w-2/3 max-w-xs" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-11 w-32 shrink-0 max-md:w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: sections }, (_, section) => (
          <div key={section} className="panel-card p-5 sm:p-6">
            <Skeleton className="mb-4 h-5 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-20 shrink-0" />
                  <Skeleton className="h-3.5 w-32 max-w-[50%]" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type FormSkeletonProps = {
  /** Label + input pairs to draw (default 6). */
  fields?: number;
  className?: string;
};

/**
 * Skeleton for forms (page cards and dialogs alike): label + input pairs in
 * the standard sm:grid-cols-2 form grid, then a footer actions row that
 * stacks full-width on phones. Drop it inside the page's own form-card /
 * panel-card / Dialog chrome.
 */
export function FormSkeleton({ fields = 6, className }: FormSkeletonProps) {
  return (
    <div role="status" className={cn("space-y-5", className)}>
      <LoadingStatus />
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, field) => (
          <div key={field} className="space-y-2">
            <Skeleton className="h-4 w-24 max-w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-32" />
      </div>
    </div>
  );
}

export type InlineBlockSkeletonProps = {
  className?: string;
};

/** Small inline placeholder for text-sized spots (badges, cells, counts). */
export function InlineBlockSkeleton({ className }: InlineBlockSkeletonProps) {
  return <Skeleton className={cn("inline-block h-4 w-24 rounded-md", className)} />;
}
