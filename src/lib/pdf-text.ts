// Browser-only PDF text extraction. Imported lazily from client event handlers.
export type ExtractedPdf = {
  text: string;
  pages: number;
};

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
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

  return { text: parts.join("\n\n"), pages: doc.numPages };
}
