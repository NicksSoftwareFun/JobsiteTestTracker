import type { FieldDef, SectionDef } from '../types';

// Shared "Project / Administrative" block used by EVERY template. Because all
// templates reuse these exact field keys, saved project admin data autofills
// identically across every form (project.adminValues is keyed by field key).
//
// Keep this the single source of truth for job-level data. Form-specific fields
// belong in each template's own sections, not here.

export const adminFields: FieldDef[] = [
  { key: 'projectName', label: 'Project Name', type: 'text', autofill: 'project' },
  { key: 'jobNumber', label: 'Job Number', type: 'text', autofill: 'project', required: true },
  { key: 'generalContractor', label: 'General Contractor', type: 'text', autofill: 'project' },
  { key: 'projectManager', label: 'Project Manager', type: 'text', autofill: 'project' },
];

export const adminSection: SectionDef = {
  id: 'admin',
  title: 'Project / Administrative',
  fieldKeys: adminFields.map((f) => f.key),
};
