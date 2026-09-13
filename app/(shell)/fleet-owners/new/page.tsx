"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createFleetOwner } from "@/lib/actions/fleet-owners";
import { createFleetOwnerSchema } from "@/lib/schemas/p1";
import { RouteDialog } from "@/components/ui/route-dialog";

const formSchema = createFleetOwnerSchema.extend({
  passwordConfirmation: z.string().min(1, "أكد كلمة السر"),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ["passwordConfirmation"],
  message: "كلمتا السر غير متطابقتين",
});

type Values = z.input<typeof formSchema>;
const fields: { name: keyof Values; label: string; placeholder?: string; type?: string; dir?: "ltr"; autoComplete?: string }[] = [
  { name: "name", label: "الاسم بالكامل", placeholder: "أحمد حسن", autoComplete: "name" },
  { name: "nickname", label: "اسم الشهرة", placeholder: "أحمد", autoComplete: "off" },
  { name: "phone", label: "رقم الموبايل", placeholder: "01xxxxxxxxx", dir: "ltr", autoComplete: "tel" },
  { name: "nationalId", label: "الرقم القومي (اختياري)", placeholder: "14 رقم", dir: "ltr", autoComplete: "off" },
  { name: "fleetName", label: "اسم الأسطول", placeholder: "نقل أحمد", autoComplete: "organization" },
  { name: "picture", label: "رابط الصورة (اختياري)", placeholder: "https://…", dir: "ltr", autoComplete: "url" },
  { name: "password", label: "كلمة السر", type: "password", dir: "ltr", autoComplete: "new-password" },
  { name: "passwordConfirmation", label: "تأكيد كلمة السر", type: "password", dir: "ltr", autoComplete: "new-password" },
];

export default function NewFleetOwnerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", nickname: "", phone: "", nationalId: "", fleetName: "", picture: "", password: "", passwordConfirmation: "" },
  });

  async function submit(values: Values) {
    setError(null);
    const result = await createFleetOwner({
      name: values.name,
      nickname: values.nickname,
      phone: values.phone,
      password: values.password,
      fleetName: values.fleetName,
      nationalId: values.nationalId || undefined,
      picture: values.picture || undefined,
    });
    if (!result.ok) {
      for (const [key, message] of Object.entries(result.fields ?? {})) {
        if (key in form.getValues()) form.setError(key as keyof Values, { message });
      }
      setError(result.message);
      return;
    }
    router.push(`/fleet-owners/${result.data.id}`);
    router.refresh();
  }

  return (
    <RouteDialog title="إضافة مالك أسطول" description="هننشئ الحساب والأسطول الأول وعضوية المالك في خطوة واحدة." fallbackHref="/fleet-owners" size="lg">
      <div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 md:grid-cols-2" noValidate>
            {fields.map((item) => (
              <FormField key={item.name} control={form.control} name={item.name} render={({ field }) => (
                <FormItem>
                  <FormLabel>{item.label}</FormLabel>
                  <FormControl><Input {...field} value={String(field.value ?? "")} type={item.type} dir={item.dir} placeholder={item.placeholder} autoComplete={item.autoComplete} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2"><Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "جاري إنشاء الحساب…" : "إنشاء المالك والأسطول"}</Button></div>
          </form>
        </Form>
      </div>
    </RouteDialog>
  );
}
