import { NextResponse } from "next/server";
import { buildSpikePdf } from "@/lib/pdf/spike";
import { toArabicError } from "@/lib/errors";
import { t } from "@/lib/i18n/t";

/**
 * GET /api/reports/spike — one-page pdfkit proof with embedded Cairo font.
 * Dashboard-only route (NOT a backend proxy). Verdict by human visual inspection.
 */
export async function GET() {
  let pdf: Buffer;
  try {
    pdf = await buildSpikePdf();
  } catch {
    return NextResponse.json(
      { statusCode: 500, code: "UNKNOWN", message: toArabicError("UNKNOWN") },
      { status: 500 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = t("reports.spikeFilename", { date: date });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
