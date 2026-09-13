"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";

type RouteDialogProps = {
  title: string;
  description?: string;
  fallbackHref: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
};

export function RouteDialog({ title, description, fallbackHref, children, size }: RouteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) router.push(fallbackHref);
  }, [fallbackHref, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size={size}
    >
      {children}
    </Dialog>
  );
}
