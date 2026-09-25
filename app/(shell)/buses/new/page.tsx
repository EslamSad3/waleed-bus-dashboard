"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBusSchema } from "@/lib/schemas/p1";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBus, fetchBrands, uploadBusImage, type VehicleBrand } from "@/lib/actions/buses";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { RouteDialog } from "@/components/ui/route-dialog";

type Values = z.input<typeof createBusSchema>;
const EDITABLE_KEYS = ["registrationNumber", "plateNumber", "color", "imageUrl", "brandId", "isAirConditioned", "modelYear", "capacity"] as const;

export default function NewBusPage() {
  const router = useRouter();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createBusSchema),
    defaultValues: {
      registrationNumber: "",
      plateNumber: "",
      color: "",
      imageUrl: "",
      brandId: null,
      isAirConditioned: false,
      modelYear: undefined as unknown as number,
      capacity: undefined as unknown as number,
    },
  });

  useEffect(() => {
    fetchBrands().then((result) => {
      if (result.ok) setBrands(result.data);
    });
  }, []);

  async function onFileSelect(file: File | null) {
    setImageFile(file);
    setFormError(null);
    if (!file) return;
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل رفع الصورة.");
      return;
    }
    setUploading(true);
    const uploaded = await uploadBusImage(fleetId, file);
    setUploading(false);
    if (!uploaded.ok) {
      setFormError(uploaded.message);
      return;
    }
    form.setValue("imageUrl", uploaded.data.url, { shouldValidate: true });
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة الأتوبيس.");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createBus(fleetId, {
      ...values,
      brandId: values.brandId || null,
      modelYear: values.modelYear ?? undefined,
    });
    if (!r.ok) {
      if (r.fields) {
        for (const [key, msg] of Object.entries(r.fields)) {
          if ((EDITABLE_KEYS as readonly string[]).includes(key)) {
            form.setError(key as (typeof EDITABLE_KEYS)[number], { message: msg });
          }
        }
      }
      setFormError(r.message);
      return;
    }
    router.push(`/buses/${r.data.id}`);
    router.refresh();
  }

  return (
    <RouteDialog title="أتوبيس جديد" description="سجّل الأتوبيس داخل أسطوله: اللوحة واللون والصورة مطلوبين." fallbackHref="/buses" size="sm">
      <div>
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={setLocalFleetId} />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم التسجيل</FormLabel>
                  <FormControl>
                    <Input dir="ltr" placeholder="BUS-A-002" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم اللوحة</FormLabel>
                  <FormControl>
                    <Input dir="ltr" placeholder="أ ب ج 1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اللون</FormLabel>
                  <FormControl>
                    <Input placeholder="أبيض" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>صورة الأتوبيس</FormLabel>
                  <FormControl>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void onFileSelect(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#2f719e] file:px-4 file:py-2 file:text-white"
                    />
                  </FormControl>
                  {uploading ? <p className="text-sm text-slate-500">جاري رفع الصورة وضغطها…</p> : null}
                  {imageFile && !uploading ? <p className="text-sm text-slate-500">{imageFile.name}</p> : null}
                  <p className="text-xs text-slate-500">الصورة تُرفع إلى التخزين السحابي تلقائيًا — لا حاجة للصق روابط خارجية.</p>
                  <input type="hidden" {...field} value={field.value ?? ""} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الماركة <span className="font-normal text-slate-400">(اختياري)</span></FormLabel>
                  <FormControl>
                    <select
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="select-field w-full"
                    >
                      <option value="">بدون ماركة…</option>
                      {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="modelYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سنة الموديل <span className="font-normal text-slate-400">(اختياري)</span></FormLabel>
                    <FormControl>
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        type="number"
                        min={1980}
                        max={2100}
                        placeholder="2022"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>السعة (1–300)</FormLabel>
                    <FormControl>
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        type="number"
                        min={1}
                        max={300}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="isAirConditioned"
              render={({ field }) => (
                <FormItem>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={field.value ?? false} onChange={(e) => field.onChange(e.target.checked)} className="size-4" />
                    مكيّف
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الأتوبيس"}
            </Button>
          </form>
        </Form>
      </div>
    </RouteDialog>
  );
}
