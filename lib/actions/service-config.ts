import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";

export type ServiceConfigEntry = {
  id: string;
  text: string;
  type: "PHONE" | "WHATSAPP" | "WEBSITE";
  value: string;
  isActive: boolean;
  sortOrder: number;
};

export type ServiceConfigEntryInput = {
  id?: string;
  text: string;
  type: "PHONE" | "WHATSAPP" | "WEBSITE";
  value: string;
  isActive?: boolean;
};

export function fetchServiceConfig(): Promise<ActionResult<ServiceConfigEntry[]>> {
  return apiGet("/api/platform/config/customer-service");
}

export function replaceServiceConfig(entries: ServiceConfigEntryInput[]): Promise<ActionResult<ServiceConfigEntry[]>> {
  return notifyResult(
    "اتحفظت إعدادات خدمة العملاء",
    apiSend("/api/platform/config/customer-service", "PUT", { entries }),
  );
}
