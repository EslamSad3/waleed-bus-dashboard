"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App-wide toaster (sonner). The dashboard is light-only RTL with custom
 * tokens (no next-themes, no shadcn --popover), so the theme is fixed and the
 * surface colors come from globals.css instead.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      dir="rtl"
      position="bottom-left"
      richColors
      closeButton
      className="toaster group"
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--line)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "shadow-[var(--shadow-md)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
