// User story 3: append a freshly generated report onto an existing multi-report
// PDF "test log", producing an updated running document (single source of truth).

import { PDFDocument } from 'pdf-lib';

/**
 * Append the pages of `newReportPdf` to the end of `existingLogPdf`.
 * Returns the bytes of the combined log.
 */
export async function appendReportToLog(
  existingLogPdf: ArrayBuffer,
  newReportPdf: Uint8Array,
): Promise<Uint8Array> {
  // ignoreEncryption lets us open "secured" PDFs (e.g. from Bluebeam/Adobe)
  // that carry permission flags but no open password.
  const log = await PDFDocument.load(existingLogPdf, { ignoreEncryption: true });
  const report = await PDFDocument.load(newReportPdf, { ignoreEncryption: true });
  const pages = await log.copyPages(report, report.getPageIndices());
  pages.forEach((p) => log.addPage(p));
  return log.save();
}
