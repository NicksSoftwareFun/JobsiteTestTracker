// Small shared helpers.

/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Display name for a report: "<template> - <title>" (title optional). */
export function reportDisplayName(templateName: string, reportTitle?: string): string {
  const t = reportTitle?.trim();
  return t ? `${templateName} - ${t}` : templateName;
}

/** Strip characters that are illegal in filenames, keeping spaces/dots/dashes. */
export function safeFileName(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
}

/** Normalize a photos field value (string[] legacy or PhotoItem[]) to items. */
export function normalizePhotos(v: unknown): { src: string; caption?: string }[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((it) =>
      typeof it === 'string'
        ? { src: it }
        : { src: (it as { src?: string }).src ?? '', caption: (it as { caption?: string }).caption },
    )
    .filter((x) => x.src);
}

export function uid(prefix = ''): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/** YYYY-MM-DD for <input type="date"> */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** HH:MM (24h) for <input type="time"> */
export function nowTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Human display for a stored date value (YYYY-MM-DD -> M/D/YYYY). */
export function displayDate(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

/** Human display for a 24h time value (HH:MM -> h:MM AM/PM). */
export function displayTime(hm: string | undefined): string {
  if (!hm) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return hm;
  let h = Number(m[1]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}
