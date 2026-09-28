import PDFDocument from "pdfkit";
import { textBidi, type PdfKitDocLike } from "bidi-shaper/pdfkit";
import fs from "node:fs";
import path from "node:path";
import { t } from "@/lib/i18n/t";

/**
 * P0 spike: prove Arabic glyph shaping in pdfkit (PRD §7 blocking risk).
 * pdfkit/fontkit shapes Arabic but performs NO BiDi reordering, so the
 * `bidi-shaper/pdfkit` adapter (shape + UAX #9 reorder, features:[]) is used.
 */
export function buildSpikePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Statically scoped under assets/fonts (basename only): keeps Turbopack
    // tracing narrow and blocks directory traversal via PDF_FONT_PATH.
    const configured = process.env.PDF_FONT_PATH ?? "Cairo-Variable.ttf";
    const fontPath = path.join(process.cwd(), "assets", "fonts", path.basename(configured));
    let fontBytes: Buffer;
    try {
      fontBytes = fs.readFileSync(fontPath);
    } catch (e) {
      reject(new Error(`Cairo font not found at PDF_FONT_PATH=${fontPath}: ${String(e)}`));
      return;
    }

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("spike-ar", fontBytes);
    doc.font("spike-ar");

    // Structural cast: the adapter only calls .text(); PDFDocument's overloads
    // are compatible at runtime but not assignable to the minimal interface.
    const rtl = (text: string, options: { align: "right"; bidi: { direction: "rtl" } }) =>
      textBidi(doc as unknown as PdfKitDocLike, text, options);

    doc.fontSize(22);
    rtl(t("pdf.spike.title"), {
      align: "right",
      bidi: { direction: "rtl" },
    });
    doc.moveDown();

    doc.fontSize(14);
    rtl(t("pdf.spike.sample"), {
      align: "right",
      bidi: { direction: "rtl" },
    });
    doc.moveDown();

    rtl(t("pdf.spike.tableHeader"), {
      align: "right",
      bidi: { direction: "rtl" },
    });
    rtl(t("pdf.spike.tableRow"), {
      align: "right",
      bidi: { direction: "rtl" },
    });

    doc.end();
  });
}
