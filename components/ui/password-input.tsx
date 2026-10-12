"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<typeof Input>, "type">
>(({ className, dir, disabled, id, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <span className="grid w-full" dir={dir}>
      <Input
        {...props}
        ref={ref}
        id={id}
        dir={dir}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={cn(className, "col-start-1 row-start-1 pe-12")}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={visible ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((value) => !value)}
        className="z-10 col-start-1 row-start-1 me-2.5 flex size-8 items-center justify-center self-center justify-self-end rounded-lg text-[#667786] transition hover:bg-[#eaf6ff] hover:text-[#00134c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </span>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
