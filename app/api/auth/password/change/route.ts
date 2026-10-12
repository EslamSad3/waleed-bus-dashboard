import { forwardAuthAction } from "@/lib/auth-forward";
import { changePasswordSchema } from "@/lib/schemas/auth";

/** POST /api/auth/password/change — signed-in change; other devices are signed out, this session stays. */
export function POST(req: Request) {
  return forwardAuthAction(req, "/auth/password/change", changePasswordSchema, { signedIn: true });
}
