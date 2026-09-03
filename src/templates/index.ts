// Template registry: merges built-in templates with user-defined ones from
// IndexedDB. Adding a new built-in form = add a schema file and list it here.
// Adding a custom form = the in-app Template Builder (no code required).

import type { FieldDef, Template } from '../types';
import { getUserTemplates } from '../db';
import { foremanDailyReport } from './foremanDailyReport';
import { pressureTestRecord } from './pressureTestRecord';
import { qcInspectionReport } from './qcInspectionReport';

// Foreman Daily Report first — the most-used form.
export const builtInTemplates: Template[] = [
  foremanDailyReport,
  pressureTestRecord,
  qcInspectionReport,
];

export async function getAllTemplates(): Promise<Template[]> {
  const user = await getUserTemplates();
  return [...builtInTemplates, ...user];
}

export async function getTemplateById(id: string): Promise<Template | undefined> {
  const all = await getAllTemplates();
  return all.find((t) => t.id === id);
}

/** Look up a field definition within a template. */
export function findField(template: Template, key: string): FieldDef | undefined {
  return template.fields.find((f) => f.key === key);
}
