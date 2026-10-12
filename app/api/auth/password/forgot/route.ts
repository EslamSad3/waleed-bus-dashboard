import { forwardAuthAction } from "@/lib/auth-forward";
import { forgotEmailSchema } from "@/lib/schemas/auth";

/** POST /api/auth/password/forgot — mails a reset code (same answer whether or not the account exists). */
export function POST(req: Request) {
  return forwardAuthAction(req, "/auth/password/forgot-email", forgotEmailSchema, { signedIn: false });
}
