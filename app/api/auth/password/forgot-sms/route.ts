import { forwardAuthAction } from "@/lib/auth-forward";
import { forgotPhoneSchema } from "@/lib/schemas/auth";

/** POST /api/auth/password/forgot-sms — sends a reset OTP to the account phone (same answer either way). */
export function POST(req: Request) {
  return forwardAuthAction(req, "/auth/password/forgot", forgotPhoneSchema, { signedIn: false });
}
