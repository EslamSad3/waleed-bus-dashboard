"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { FieldErrors } from "@/lib/field-validation";
import { t } from "@/lib/i18n/t";

type Failure = { message: string; fields?: FieldErrors };

export function useFieldValidation(check: () => Record<string, string | undefined>) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [server, setServer] = useState<FieldErrors>({});
  const controls = useRef(new Map<string, number>());
  const register = useCallback((name: string) => {
    controls.current.set(name, (controls.current.get(name) ?? 0) + 1);
    return () => {
      const count = (controls.current.get(name) ?? 1) - 1;
      if (count) controls.current.set(name, count);
      else controls.current.delete(name);
    };
  }, []);
  const current = Object.fromEntries(Object.entries(check()).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const errors = { ...Object.fromEntries(Object.entries(current).filter(([key]) => submitted || touched[key])), ...server };

  return {
    errors,
    register,
    attempt,
    touch(name: string) { setTouched((previous) => ({ ...previous, [name]: true })); },
    change(name: string) {
      setServer((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== name)));
    },
    validate() {
      setSubmitted(true);
      setAttempt((previous) => previous + 1);
      setServer({});
      return Object.keys(current).length === 0;
    },
    failure(result: Failure): string | null {
      if (!result.fields || Object.keys(result.fields).length === 0) return result.message;
      const bound: FieldErrors = {};
      let unmatched = false;
      for (const [path, message] of Object.entries(result.fields)) {
        const alias = path === "phoneNumber" ? "phone" : path === "latitude" || path === "longitude" ? "mapLink" : path;
        const candidates = [path, alias, ...path.split(".").map((_, index, parts) => parts.slice(0, parts.length - index - 1).join("."))];
        const name = candidates.find((candidate) => controls.current.has(candidate));
        if (name) bound[name] ??= /[\u0600-\u06ff]/.test(message) ? message : t("validation.invalid");
        else unmatched = true;
      }
      setServer(bound);
      setAttempt((previous) => previous + 1);
      // Never hide errors for a removed/unknown server field.
      return unmatched ? result.message : null;
    },
    reset() { setTouched({}); setSubmitted(false); setServer({}); },
  };
}

export type FieldValidation = ReturnType<typeof useFieldValidation>;
const ValidationContext = createContext<FieldValidation | undefined>(undefined);

export function ValidationScope({ validation, children }: { validation?: FieldValidation; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const attempt = validation?.attempt ?? 0;
  useEffect(() => {
    if (attempt) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"], button[data-invalid="true"]')?.focus();
  }, [attempt]);
  if (!validation) return children;
  return <ValidationContext.Provider value={validation}><div ref={ref} className="contents">{children}</div></ValidationContext.Provider>;
}

export function useValidatedField(name?: string) {
  const validation = useContext(ValidationContext);
  const register = validation?.register;
  useEffect(() => name && register ? register(name) : undefined, [name, register]);
  const id = useId();
  const error = name ? validation?.errors[name] : undefined;
  return {
    error,
    errorId: `${id}-error`,
    onBlur() { if (name) validation?.touch(name); },
    onChange() { if (name) validation?.change(name); },
  };
}

export function ValidationMessage({ name }: { name: string }) {
  const { error, errorId } = useValidatedField(name);
  return error ? <p id={errorId} role="alert" className="mt-1 block text-sm text-red-600">{error}</p> : null;
}
