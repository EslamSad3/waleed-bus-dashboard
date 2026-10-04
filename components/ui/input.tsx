"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useValidatedField } from "@/components/ui/field-validation";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { fieldName?: string }>(
  ({ className, type, fieldName, onBlur, onChange, ...props }, ref) => {
    const field = useValidatedField(fieldName);
    return <>
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[#cad8e3] bg-white px-3.5 py-2 text-sm text-[#17212b] shadow-[0_1px_0_rgba(29,64,89,.03)] placeholder:text-[#8b98a5] transition-[border-color,box-shadow] focus-visible:border-[#059ff8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#059ff8]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className,
        field.error && "border-red-500",
      )}
      {...props}
      aria-invalid={field.error ? true : props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], field.error ? field.errorId : undefined].filter(Boolean).join(" ") || undefined}
      onBlur={(event) => { field.onBlur(); onBlur?.(event); }}
      onChange={(event) => { field.onChange(); onChange?.(event); }}
    />
    {field.error ? <span id={field.errorId} role="alert" className="mt-1 block text-sm text-red-600">{field.error}</span> : null}
    </>;
  },
);
Input.displayName = "Input";

export { Input };
