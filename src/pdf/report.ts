import type { Report, Template } from '../types';
import { compositeDrawing } from './composite';
import { generateReportPdf } from './generatePdf';
import { reportDisplayName, safeFileName } from '../utils';

/** Build the combined report PDF (bytes + filename) for a report. Shared by the
 *  editor's "Generate PDF" and the reports-list "Share" action. */
export async function buildReportPdf(
  report: Report,
  template: Template,
): Promise<{ bytes: Uint8Array; name: string }> {
  const drawingImages: string[] = [];
  for (const d of report.drawings ?? []) {
    if (d.backgroundDataUrl) drawingImages.push(await compositeDrawing(d));
  }
  const photosPerPage = Number(localStorage.getItem('qc-photosPerPage')) || 2;
  const bytes = await generateReportPdf({ template, report, drawingImages, photosPerPage });
  const name = safeFileName(reportDisplayName(template.name, report.reportTitle)) + '.pdf';
  return { bytes, name };
}
