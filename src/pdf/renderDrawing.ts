// Turn a user-selected drawing (PDF or image) into a raster image (data URL)
// that becomes the background of the markup canvas.

import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves the pdf.js ESM worker to a served URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface RenderedDrawing {
  dataUrl: string;
  width: number;
  height: number;
}

/** Render the first page of a PDF to a PNG data URL. */
async function renderPdf(data: ArrayBuffer, targetLongEdge = 2200): Promise<RenderedDrawing> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetLongEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** Load an image file into a data URL, capturing natural dimensions. */
function renderImage(file: Blob): Promise<RenderedDrawing> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () =>
        resolve({ dataUrl: String(reader.result), width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function renderDrawingFile(file: File): Promise<RenderedDrawing> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return renderPdf(await file.arrayBuffer());
  }
  return renderImage(file);
}

/** Load a bundled asset URL (the sample drawing) as a RenderedDrawing. */
export async function renderDrawingUrl(url: string): Promise<RenderedDrawing> {
  const res = await fetch(url);
  const blob = await res.blob();
  if (url.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf') {
    return renderPdf(await blob.arrayBuffer());
  }
  return renderImage(blob);
}
