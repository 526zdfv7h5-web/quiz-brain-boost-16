// Browser-only PDF text extraction. Imported lazily from client event handlers.
export type ExtractedPdf = {
  text: string;
  pages: number;
};

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  if (!(file instanceof File)) throw new Error("Please choose a PDF document.");

  const fileNameIsPdf = file.name.toLowerCase().endsWith(".pdf");
  const mimeIsPdf = file.type === "application/pdf";
  if (!fileNameIsPdf && !mimeIsPdf) {
    throw new Error("That file isn't a PDF. Please upload a PDF document.");
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") {
    throw new Error("This file is not a valid PDF document.");
  }

  // The modern PDF.js build calls Promise.withResolvers(), which is unavailable
  // in Safari before 17.4. The legacy build includes the required compatibility
  // implementation and remains browser-only through this lazy import.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const parts: string[] = [];
  const maxPages = Math.min(doc.numPages, 60);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(`[Page ${i}]\n${pageText}`);
  }

  const text = parts.join("\n\n").trim();
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      "We couldn't find readable text in this PDF. It may be scanned or image-only.",
    );
  }

  return { text, pages: doc.numPages };
}
