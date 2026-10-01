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
    // Skip the test-only "Sample drawing" that older reports may still carry,
    // unless it was actually marked up.
    const markup = d.fabricJson as { objects?: unknown[] } | null;
    const isUntouchedSample =
      d.name === 'Sample drawing' && !(markup && Array.isArray(markup.objects) && markup.objects.length);
    if (d.backgroundDataUrl && !isUntouchedSample) drawingImages.push(await compositeDrawing(d));
  }
  const photosPerPage = Number(localStorage.getItem('qc-photosPerPage')) || 2;
  const bytes = await generateReportPdf({
    template,
    report,
    drawingImages,
    attachments: report.attachments ?? [],
    photosPerPage,
  });
  const name = safeFileName(reportDisplayName(template.name, report.reportTitle)) + '.pdf';
  return { bytes, name };
}
