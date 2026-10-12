import { forwardAuthAction } from "@/lib/auth-forward";
import { resetPhoneSchema } from "@/lib/schemas/auth";

/** POST /api/auth/password/reset-sms — verifies the SMS code and sets the new password in one call. */
export function POST(req: Request) {
  return forwardAuthAction(req, "/auth/password/reset", resetPhoneSchema, { signedIn: false });
}
