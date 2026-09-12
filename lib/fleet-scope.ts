import { cookies } from "next/headers";
import { FLEET_SCOPE_COOKIE } from "@/lib/fleet-scope-cookie";

/** Server-side reader for Server Components / Actions (tenant calls pass it to `busFetch`). */
export async function getFleetScope(): Promise<string | null> {
  const store = await cookies();
  return store.get(FLEET_SCOPE_COOKIE)?.value ?? null;
}
