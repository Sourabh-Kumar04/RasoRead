/**
 * PDF.js worker setup for Next.js.
 * Import this once (e.g. in the reader page) before using pdfjs-dist.
 */

let configured = false;

export async function configurePdfJs() {
  if (configured || typeof window === "undefined") return;

  const pdfjsLib = await import("pdfjs-dist");

  // Use the bundled worker from pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  configured = true;
  return pdfjsLib;
}

/**
 * Render a single PDF page to a canvas element.
 * Used for generating book cover thumbnails.
 */
export async function renderPdfPage(
  pdfData: ArrayBuffer,
  pageNum = 1,
  scale = 0.5
): Promise<string> {
  const pdfjsLib = await configurePdfJs();
  if (!pdfjsLib) throw new Error("pdfjs not available");

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL("image/jpeg", 0.8);
}
