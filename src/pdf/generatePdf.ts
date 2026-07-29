// Build the combined closeout PDF with pdf-lib:
//   page 1 = branded report on a SINGLE page, signatures included (schema-driven,
//            native text — crisp & legible, compact two-column layout)
//   page 2 = the marked-up drawing rendered as a high-resolution image
//
// Being schema-driven means custom templates render through the same path.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { CheckboxPairValue, DrawingState, Report, Template } from '../types';
import { displayDate, displayTime } from '../utils';
import logoUrl from '../assets/warwick-logo.png';

const NAVY = rgb(0.122, 0.227, 0.373);
const BLACK = rgb(0.1, 0.1, 0.1);
const LINE = rgb(0.6, 0.6, 0.6);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 44;
const COL_GAP = 22;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

function ellipsize(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    let cur = '';
    for (const word of rawLine.split(/\s+/)) {
      const trial = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = trial;
      }
    }
    lines.push(cur);
  }
  return lines;
}

function displayValue(type: string, value: unknown): string {
  if (type === 'date') return displayDate(value as string);
  if (type === 'time') return displayTime(value as string);
  return value == null ? '' : String(value);
}

export interface GenerateArgs {
  template: Template;
  report: Report;
  /** each drawing page (background + markup) composited to a PNG data URL */
  drawingImages?: string[];
}

export async function generateReportPdf({
  template,
  report,
  drawingImages = [],
}: GenerateArgs): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 40;
  const contentW = PAGE_W - MARGIN * 2;
  const colW = (contentW - COL_GAP) / 2;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 34;
    }
  };

  // --- Header: logo + title ---
  try {
    const logo = await doc.embedPng(await fetchBytes(logoUrl));
    const w = 180;
    const h = (logo.height / logo.width) * w;
    page.drawImage(logo, { x: MARGIN, y: y - h, width: w, height: h });
    y -= h + 18;
  } catch {
    /* logo optional */
  }
  page.drawText(template.name.toUpperCase(), { x: MARGIN, y, size: 13, font: bold, color: BLACK });
  y -= 22;

  // --- Two-column layout engine ---
  let col = 0;
  let pendingH = 0;

  const flushRow = () => {
    if (col === 1) {
      y -= pendingH;
      col = 0;
    }
  };

  const cell = (h: number, render: (x: number, top: number, w: number) => void) => {
    if (col === 1 && h !== pendingH) flushRow();
    if (col === 0) ensure(h);
    const x = MARGIN + col * (colW + COL_GAP);
    render(x, y, colW);
    if (col === 0) {
      col = 1;
      pendingH = h;
    } else {
      y -= h;
      col = 0;
    }
  };

  const fullRow = (h: number, render: (x: number, top: number, w: number) => void) => {
    flushRow();
    ensure(h);
    render(MARGIN, y, contentW);
    y -= h;
  };

  const sectionTitle = (t: string) => {
    flushRow();
    ensure(20);
    page.drawText(t.toUpperCase(), { x: MARGIN, y, size: 8.5, font: bold, color: NAVY });
    y -= 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: NAVY });
    y -= 14;
  };

  const labeledCell = (x: number, top: number, w: number, label: string, value: string) => {
    page.drawText(label, { x, y: top, size: 7.5, font: bold, color: NAVY });
    page.drawText(ellipsize(value, font, 9, w), { x, y: top - 13, size: 9, font, color: BLACK });
    page.drawLine({ start: { x, y: top - 16 }, end: { x: x + w, y: top - 16 }, thickness: 0.5, color: LINE });
  };

  const checkboxCell = (
    x: number,
    top: number,
    w: number,
    label: string,
    opts: [string, string],
    v: CheckboxPairValue,
  ) => {
    page.drawText(label, { x, y: top, size: 7.5, font: bold, color: NAVY });
    let cx = x;
    const draw = (checked: boolean, text: string) => {
      page.drawText(checked ? '[X]' : '[  ]', { x: cx, y: top - 13, size: 9, font: bold, color: BLACK });
      cx += 22;
      page.drawText(text, { x: cx, y: top - 13, size: 9, font, color: BLACK });
      cx += font.widthOfTextAtSize(text, 9) + 22;
    };
    draw(v?.left ?? false, opts[0]);
    draw(v?.right ?? false, opts[1]);
    page.drawLine({ start: { x, y: top - 16 }, end: { x: x + w, y: top - 16 }, thickness: 0.5, color: LINE });
  };

  const signatureCell = async (x: number, top: number, w: number, label: string, dataUrl?: string) => {
    const boxH = 34;
    if (dataUrl) {
      try {
        const png = await doc.embedPng(dataUrl);
        const scale = Math.min(w / png.width, boxH / png.height);
        page.drawImage(png, { x, y: top - boxH, width: png.width * scale, height: png.height * scale });
      } catch {
        /* ignore bad signature data */
      }
    }
    page.drawLine({ start: { x, y: top - boxH - 2 }, end: { x: x + w, y: top - boxH - 2 }, thickness: 0.6, color: LINE });
    page.drawText(label, { x, y: top - boxH - 12, size: 7.5, font, color: BLACK });
  };

  const multilineFull = (x: number, top: number, w: number, label: string, value: string) => {
    page.drawText(label, { x, y: top, size: 8.5, font: bold, color: NAVY });
    const boxTop = top - 12;
    const boxH = 52;
    page.drawRectangle({ x, y: boxTop - boxH, width: w, height: boxH, borderColor: LINE, borderWidth: 0.75 });
    let ty = boxTop - 12;
    for (const ln of wrap(value || '', font, 9, w - 12).slice(0, 3)) {
      page.drawText(ln, { x: x + 6, y: ty, size: 9, font, color: BLACK });
      ty -= 12;
    }
  };

  // --- Render sections ---
  const SIMPLE_H = 26;
  const SIG_H = 62;
  const MULTI_H = 78;

  for (const section of template.sections) {
    if (section.title) sectionTitle(section.title);
    for (const key of section.fieldKeys) {
      const field = template.fields.find((f) => f.key === key);
      if (!field) continue;
      const raw = report.values[key];
      switch (field.type) {
        case 'multiline':
          fullRow(MULTI_H, (x, top, w) => multilineFull(x, top, w, field.label, (raw as string) || ''));
          break;
        case 'checkboxPair':
          cell(SIMPLE_H, (x, top, w) =>
            checkboxCell(x, top, w, field.label, field.options ?? ['', ''], (raw as CheckboxPairValue) ?? { left: false, right: false }),
          );
          break;
        case 'signature':
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve) => {
            cell(SIG_H, (x, top, w) => {
              void signatureCell(x, top, w, field.label, raw as string | undefined).then(resolve);
            });
          });
          break;
        case 'photos': {
          // Photos render on their own page(s) at the end; note the count here.
          const n = Array.isArray(raw) ? raw.length : 0;
          cell(SIMPLE_H, (x, top, w) =>
            labeledCell(x, top, w, field.label, n ? `${n} photo${n === 1 ? '' : 's'} attached (see end)` : 'None'),
          );
          break;
        }
        default:
          cell(SIMPLE_H, (x, top, w) => labeledCell(x, top, w, field.label, displayValue(field.type, raw)));
      }
    }
    flushRow();
    y -= 6;
  }

  // Gather attached photos up front so we can both note and render them.
  const photos: string[] = [];
  for (const f of template.fields) {
    if (f.type === 'photos') {
      const v = report.values[f.key];
      if (Array.isArray(v)) photos.push(...(v as string[]));
    }
  }

  // Blank drawing/photo pages are simply not added. When either is absent, note
  // it at the bottom of the first page so the omission is explicit.
  const notes: string[] = [];
  if (drawingImages.length === 0) notes.push('No Drawings Included');
  if (photos.length === 0) notes.push('No Photos Included');
  if (notes.length) {
    const first = doc.getPage(0);
    let ny = MARGIN;
    for (const n of [...notes].reverse()) {
      first.drawText(n, { x: MARGIN, y: ny, size: 10, font: bold, color: rgb(0.45, 0.45, 0.45) });
      ny += 15;
    }
  }

  // One page per marked-up drawing.
  for (let i = 0; i < drawingImages.length; i++) {
    const label =
      drawingImages.length > 1
        ? `TESTED AREA — MARKED-UP DRAWING (${i + 1} of ${drawingImages.length})`
        : 'TESTED AREA — MARKED-UP DRAWING';
    await addDrawingPage(doc, bold, drawingImages[i], label);
  }

  // Attached photos on their own page(s).
  if (photos.length) await addPhotoPages(doc, bold, photos);

  return doc.save();
}

async function addDrawingPage(doc: PDFDocument, bold: PDFFont, dataUrl: string, label: string) {
  const png = await doc.embedPng(dataUrl);
  const landscape = png.width >= png.height;
  const pw = landscape ? PAGE_H : PAGE_W;
  const ph = landscape ? PAGE_W : PAGE_H;
  const page = doc.addPage([pw, ph]);
  const topPad = 40;
  page.drawText(label, { x: MARGIN, y: ph - 28, size: 11, font: bold, color: NAVY });
  const availW = pw - MARGIN * 2;
  const availH = ph - MARGIN - topPad;
  const scale = Math.min(availW / png.width, availH / png.height);
  const w = png.width * scale;
  const h = png.height * scale;
  page.drawImage(png, { x: (pw - w) / 2, y: (ph - topPad - h) / 2, width: w, height: h });
}

/** Lay attached photos out two-per-row across portrait pages. */
async function addPhotoPages(doc: PDFDocument, bold: PDFFont, photos: string[]) {
  const cols = 2;
  const gap = 16;
  const topPad = 44;
  const cellW = (PAGE_W - MARGIN * 2 - gap) / cols;
  const cellH = cellW; // square-ish slots
  const perRow = cols;
  const rowsPerPage = Math.max(1, Math.floor((PAGE_H - MARGIN - topPad) / (cellH + gap)));
  const perPage = perRow * rowsPerPage;

  for (let i = 0; i < photos.length; i++) {
    if (i % perPage === 0) {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      page.drawText('ATTACHED PHOTOS', { x: MARGIN, y: PAGE_H - 28, size: 11, font: bold, color: NAVY });
    }
    const page = doc.getPage(doc.getPageCount() - 1);
    const idx = i % perPage;
    const rc = idx % perRow;
    const rr = Math.floor(idx / perRow);
    const x = MARGIN + rc * (cellW + gap);
    const yTop = PAGE_H - topPad - rr * (cellH + gap);
    let img;
    try {
      img = photos[i].startsWith('data:image/png')
        ? await doc.embedPng(photos[i])
        : await doc.embedJpg(photos[i]);
    } catch {
      continue;
    }
    const scale = Math.min(cellW / img.width, cellH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: x + (cellW - w) / 2, y: yTop - h, width: w, height: h });
  }
}

export function drawingHasContent(d: DrawingState | null | undefined): boolean {
  return !!d && !!d.backgroundDataUrl;
}
