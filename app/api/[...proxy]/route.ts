import { NextResponse, type NextRequest } from "next/server";
import { busFetch } from "@/lib/api";
import { originAllowed } from "@/lib/config";
import { toArabicError } from "@/lib/errors";
import { findRegistryEntry } from "@/lib/schemas/p1";

type Ctx = { params: Promise<{ proxy: string[] }> };

/**
 * Generic BFF forwarder (clarification Q2: full forwarder in P0).
 * Attaches the JWT server-side, unwraps `{statusCode, data}` once, maps
 * backend codes to Egyptian-Arabic copy. More specific routes
 * (/api/auth/*, /api/health, /api/reports/*) take precedence.
 */
async function forward(req: NextRequest, ctx: Ctx, method: string) {
  const { proxy } = await ctx.params;
  const path = `/${proxy.join("/")}${req.nextUrl.search}`;

  if (method !== "GET" && !originAllowed(req)) {
    return NextResponse.json(
      { statusCode: 403, code: "FORBIDDEN", message: "ممنوع" },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");

  let body: unknown;
  let rawBody: { bytes: ArrayBuffer; contentType: string } | undefined;
  if (method !== "GET") {
    if (isMultipart) {
      // File uploads (e.g. bus images) pass through byte-identical.
      rawBody = {
        bytes: await req.arrayBuffer(),
        contentType,
      };
    } else {
      const text = await req.text().catch(() => "");
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          return NextResponse.json(
            {
              statusCode: 400,
              code: "VALIDATION_FAILED",
              message: toArabicError("VALIDATION_FAILED"),
            },
            { status: 400 },
          );
        }
      }
    }
  }

  const fleetId = req.headers.get("x-fleet-id");

  // P1 trust-boundary re-validation: per-resource zod schemas (research R2).
  // Unmatched paths pass through unvalidated (P0 behavior preserved).
  if (method !== "GET" && body !== undefined) {
    const pathname = `/${proxy.join("/")}`;
    const entry = findRegistryEntry(method, pathname);
    if (entry) {
      const parsed = entry.schema.safeParse(body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".") || "_";
          if (!(key in fields)) fields[key] = issue.message;
        }
        return NextResponse.json(
          {
            statusCode: 400,
            code: "VALIDATION_FAILED",
            message: toArabicError("VALIDATION_FAILED"),
            details: { fields },
          },
          { status: 400 },
        );
      }
      body = parsed.data;
    }
  }

  const result = await busFetch(path, { method, body, rawBody, fleetId });

  if (!result.ok) {
    const status = result.status === 0 ? 503 : result.status;
    return NextResponse.json(
      {
        statusCode: status,
        code: result.code,
        message: toArabicError(result.code, result.status),
        ...(result.details ? { details: result.details } : {}),
      },
      { status },
    );
  }
  return NextResponse.json({ statusCode: result.status, data: result.data });
}

export function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "GET");
}
export function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "POST");
}
export function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "PATCH");
}
export function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, ctx, "DELETE");
}
