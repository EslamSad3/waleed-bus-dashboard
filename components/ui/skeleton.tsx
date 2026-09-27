import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Base loading placeholder: a pulsing block tinted from the light palette's
 * line color (--line #dce6ee, lightened to sit on the #f4f8fc page
 * background). Prefer the composed shapes in components/ui/skeletons.tsx;
 * reach for Skeleton directly only for one-off spots, always sizing it via
 * className (h-* w-*).
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-[#e3ecf3]", className)}
      {...props}
    />
  );
}

export { Skeleton };
