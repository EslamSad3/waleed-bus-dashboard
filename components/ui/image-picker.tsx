"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/t";

type ImagePickerProps = {
  label: string;
  /** Selected File (uncontrolled inside; surfaced through onChange). */
  file: File | null;
  onChange: (file: File | null) => void;
  /** Existing remote image to preview before a new file is chosen. */
  existingUrl?: string | null;
  uploading?: boolean;
  hint?: string;
  error?: string | null;
  required?: boolean;
};

/**
 * Image upload field (issue: images/files always go up as FormData, never a
 * pasted URL). Shows a live local preview of the chosen file, or the existing
 * remote image when no new file is picked yet.
 */
export function ImagePicker({
  label,
  file,
  onChange,
  existingUrl,
  uploading,
  hint,
  error,
  required,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Object URL derived in render; the previous URL is revoked on change/unmount.
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  if (preview !== lastUrl) {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    setLastUrl(preview);
  }
  useEffect(() => {
    return () => {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    };
  }, [lastUrl]);

  const shown = preview ?? existingUrl ?? null;

  return (
    <div className="block text-sm">
      <span className="mb-1.5 block font-bold text-[#334454]">
        {label}
        {required ? <span className="text-[#dc2626]"> *</span> : null}
      </span>
      <div className="flex items-center gap-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#d8e4ec] bg-[#f8fbfd]">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={t("ui.imagePicker.previewAlt")} className="size-full object-cover" />
          ) : (
            <span className="text-xs text-[#8b98a5]">{t("ui.imagePicker.empty")}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#eaf6ff] px-4 text-xs font-extrabold text-[#00134c] transition hover:bg-[#d6eeff] disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t("ui.imagePicker.choose")}
          </button>
          {file ? (
            <p className="truncate text-xs text-[#5e6b78]">{file.name}</p>
          ) : null}
          {uploading ? <p className="text-xs text-[#059ff8]">{t("ui.imagePicker.uploading")}</p> : null}
          {hint ? <p className="text-xs text-[#8b98a5]">{hint}</p> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      {error ? <p role="alert" className="mt-1 text-sm text-[#dc2626]">{error}</p> : null}
    </div>
  );
}
