import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#cad8e3] bg-white px-3.5 py-2 text-sm text-[#17212b] shadow-[0_1px_0_rgba(29,64,89,.03)] placeholder:text-[#8b98a5] transition-[border-color,box-shadow] focus-visible:border-[#2f719e] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f719e]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
