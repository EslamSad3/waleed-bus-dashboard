"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FleetOwnerFleetPicker } from "@/components/fleet-owner-fleet-picker";
import { inviteDriver } from "@/lib/actions/members";
import { driverFreshSchema } from "@/lib/schemas/p1";
import { RouteDialog } from "@/components/ui/route-dialog";

const formSchema = driverFreshSchema.extend({
  passwordConfirmation: z.string().min(1, "أكد كلمة السر"),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ["passwordConfirmation"],
  message: "كلمتا السر غير متطابقتين",
});
type Values = z.input<typeof formSchema>;

export default function NewDriverPage() {
  const router = useRouter();
  const [fleetId, setFleetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", nickname: "", phone: "", password: "", passwordConfirmation: "", picture: "", nationalId: "" },
  });

  async function submit(values: Values) {
    setError(null);
    if (!fleetId) {
      setError("اختار مالك الأسطول ثم الأسطول المطلوب");
      return;
    }
    const result = await inviteDriver(fleetId, {
      name: values.name,
      nickname: values.nickname,
      phone: values.phone,
      password: values.password,
      picture: values.picture || undefined,
      nationalId: values.nationalId || undefined,
    });
    if (!result.ok) {
      for (const [key, message] of Object.entries(result.fields ?? {})) {
        if (key in form.getValues()) form.setError(key as keyof Values, { message });
      }
      setError(result.message);
      return;
    }
    router.push(`/drivers/${result.data.id}?fleetId=${fleetId}`);
    router.refresh();
  }

  const fields: { name: keyof Values; label: string; type?: string; dir?: "ltr"; placeholder?: string }[] = [
    { name: "name", label: "الاسم بالكامل", placeholder: "كريم علي" },
    { name: "nickname", label: "اسم الشهرة", placeholder: "كريم" },
    { name: "phone", label: "رقم الموبايل", placeholder: "01xxxxxxxxx", dir: "ltr" },
    { name: "nationalId", label: "الرقم القومي (اختياري)", placeholder: "14 رقم", dir: "ltr" },
    { name: "picture", label: "رابط الصورة (اختياري)", placeholder: "https://…", dir: "ltr" },
    { name: "password", label: "كلمة السر", type: "password", dir: "ltr" },
    { name: "passwordConfirmation", label: "تأكيد كلمة السر", type: "password", dir: "ltr" },
  ];

  return (
    <RouteDialog title="إضافة سواق" description="اختر مالك الأسطول أولًا. تعيين الأتوبيس يتم لاحقًا من إدارة الأتوبيسات." fallbackHref="/drivers" size="lg">
      <div>
        <div className="mb-5"><FleetOwnerFleetPicker fleetId={fleetId} onFleetChange={setFleetId} /></div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 md:grid-cols-2" noValidate>
            {fields.map((item) => <FormField key={item.name} control={form.control} name={item.name} render={({ field }) => (
              <FormItem><FormLabel>{item.label}</FormLabel><FormControl><Input {...field} value={String(field.value ?? "")} type={item.type} dir={item.dir} placeholder={item.placeholder} /></FormControl><FormMessage /></FormItem>
            )} />)}
            {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2"><Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "جاري إنشاء الحساب…" : "إنشاء حساب السواق"}</Button></div>
          </form>
        </Form>
      </div>
    </RouteDialog>
  );
}
