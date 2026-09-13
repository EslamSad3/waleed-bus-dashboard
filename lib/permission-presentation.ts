import type { Permission } from "@/lib/actions/permissions";

type PermissionPresentation = {
  group: string;
  title: string;
  description: string;
};

const RESOURCES: Record<string, { group: string; name: string }> = {
  users: { group: "الحسابات", name: "حسابات المستخدمين" },
  fleets: { group: "التشغيل", name: "الأساطيل" },
  buses: { group: "التشغيل", name: "الأتوبيسات" },
  trips: { group: "التشغيل", name: "الرحلات" },
  bookings: { group: "التشغيل", name: "الحجوزات" },
  members: { group: "التشغيل", name: "أعضاء الأسطول" },
  "fleet.buses": { group: "تشغيل الأسطول", name: "أتوبيسات الأسطول" },
  "fleet.trips": { group: "تشغيل الأسطول", name: "رحلات الأسطول" },
  "fleet.drivers": { group: "تشغيل الأسطول", name: "سائقي الأسطول" },
  "fleet.reports": { group: "تشغيل الأسطول", name: "تقارير الأسطول" },
  roles: { group: "إدارة النظام", name: "أدوار الوصول" },
  permissions: { group: "إدارة النظام", name: "دليل الصلاحيات" },
  audit: { group: "إدارة النظام", name: "سجل النشاط" },
  driver: { group: "تشغيل السائق", name: "مهام السائق" },
};

const ACTIONS: Record<string, string> = {
  read: "عرض",
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  manage: "إدارة",
  operate: "تنفيذ المهام التشغيلية",
};

/** Converts API permission identifiers into administrator-friendly Arabic. */
export function presentPermission(permission: Pick<Permission, "key" | "resource" | "action" | "description">): PermissionPresentation {
  const resource = RESOURCES[permission.resource] ?? { group: "صلاحيات أخرى", name: "إعدادات إضافية" };
  const action = ACTIONS[permission.action] ?? "استخدام";
  return {
    group: resource.group,
    title: `${action} ${resource.name}`,
    description: permission.description || `يسمح هذا الدور بـ${action} ${resource.name}.`,
  };
}
