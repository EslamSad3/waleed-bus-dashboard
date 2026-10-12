import { forwardAuthAction } from "@/lib/auth-forward";
import { resetEmailSchema } from "@/lib/schemas/auth";

/** POST /api/auth/password/reset — verifies the mailed code and sets the new password in one call. */
export function POST(req: Request) {
  return forwardAuthAction(req, "/auth/password/reset-email", resetEmailSchema, { signedIn: false });
}
