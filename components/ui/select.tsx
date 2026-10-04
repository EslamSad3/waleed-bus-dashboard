"use client";

import { forwardRef, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useValidatedField } from "@/components/ui/field-validation";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { fieldName?: string }>(
  ({ fieldName, onBlur, onChange, className, ...props }, ref) => {
    const field = useValidatedField(fieldName);
    return <><select {...props} ref={ref} className={cn(className, field.error && "border-red-500")}
      aria-invalid={field.error ? true : props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], field.error ? field.errorId : undefined].filter(Boolean).join(" ") || undefined}
      onBlur={(event) => { field.onBlur(); onBlur?.(event); }}
      onChange={(event) => { field.onChange(); onChange?.(event); }} />
      {field.error ? <span id={field.errorId} role="alert" className="mt-1 block text-sm text-red-600">{field.error}</span> : null}</>;
  },
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { fieldName?: string }>(
  ({ fieldName, onBlur, onChange, className, ...props }, ref) => {
    const field = useValidatedField(fieldName);
    return <><textarea {...props} ref={ref} className={cn(className, field.error && "border-red-500")}
      aria-invalid={field.error ? true : props["aria-invalid"]}
      aria-describedby={[props["aria-describedby"], field.error ? field.errorId : undefined].filter(Boolean).join(" ") || undefined}
      onBlur={(event) => { field.onBlur(); onBlur?.(event); }}
      onChange={(event) => { field.onChange(); onChange?.(event); }} />
      {field.error ? <span id={field.errorId} role="alert" className="mt-1 block text-sm text-red-600">{field.error}</span> : null}</>;
  },
);
Textarea.displayName = "Textarea";
