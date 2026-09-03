import type { Template } from '../types';
import { adminFields, adminSection } from './adminBlock';

// Built-in template derived from the Warwick "Quality Control Inspection Report"
// Word form. Uses the shared admin block; inspector/subcontractor and inspection
// details are form-specific sections.

export const qcInspectionReport: Template = {
  id: 'builtin.qc-inspection-report',
  name: 'Quality Control Inspection Report',
  builtIn: true,
  createdAt: 1,
  sections: [
    adminSection,
    {
      id: 'details',
      title: 'Inspection Details',
      fieldKeys: [
        'subcontractor',
        'qcInspectorName',
        'qcInspectorEmail',
        'date',
        'inspectionNumber',
        'scopeOfWork',
        'drawingReference',
        'specReference',
        'submittalReference',
      ],
    },
    {
      id: 'findings',
      title: 'Findings',
      fieldKeys: ['workDescription', 'inspectionFinding', 'compliance', 'notes'],
    },
    {
      id: 'corrections',
      title: 'Corrections',
      fieldKeys: ['recommendedCorrections', 'correctionsMadeBy'],
    },
    {
      id: 'photos',
      title: 'Photographic Record',
      fieldKeys: ['photos'],
    },
    {
      id: 'signoff',
      title: 'Sign-off',
      fieldKeys: ['signature', 'inspector', 'reinspectionDate'],
    },
  ],
  fields: [
    ...adminFields,

    // --- Inspection details (form-specific) ---
    { key: 'subcontractor', label: 'Subcontractor', type: 'text', autofill: 'perTest' },
    { key: 'qcInspectorName', label: 'QC Inspector Name', type: 'text', autofill: 'perTest' },
    { key: 'qcInspectorEmail', label: 'QC Inspector Email', type: 'text', autofill: 'perTest' },
    { key: 'date', label: 'Date', type: 'date', autofill: 'perTest', default: 'today', required: true },
    { key: 'inspectionNumber', label: 'QC Inspection Number', type: 'text', autofill: 'perTest' },
    { key: 'scopeOfWork', label: 'Scope of Work', type: 'text', autofill: 'perTest' },
    { key: 'drawingReference', label: 'Drawing Reference', type: 'text', autofill: 'perTest' },
    { key: 'specReference', label: 'Specification Reference', type: 'text', autofill: 'perTest' },
    { key: 'submittalReference', label: 'Submittal Reference', type: 'text', autofill: 'perTest' },

    // --- Findings ---
    { key: 'workDescription', label: 'Detailed description of work and/or material', type: 'multiline', autofill: 'perTest' },
    { key: 'inspectionFinding', label: 'Inspection Finding', type: 'multiline', autofill: 'perTest' },
    {
      key: 'compliance',
      label: 'In compliance with the Contract Documents?',
      type: 'checkboxPair',
      autofill: 'perTest',
      options: ['YES', 'NO (not in compliance)'],
    },
    { key: 'notes', label: 'Notes and Comments', type: 'multiline', autofill: 'perTest' },

    // --- Corrections ---
    { key: 'recommendedCorrections', label: 'Recommended corrections', type: 'multiline', autofill: 'perTest' },
    { key: 'correctionsMadeBy', label: 'Corrections made by', type: 'text', autofill: 'perTest' },

    // --- Photos ---
    { key: 'photos', label: 'Photographic Record(s)', type: 'photos', autofill: 'perTest' },

    // --- Sign-off ---
    { key: 'signature', label: 'Signature', type: 'signature', autofill: 'perTest' },
    { key: 'inspector', label: 'Inspector', type: 'text', autofill: 'perTest' },
    { key: 'reinspectionDate', label: 'Date for re-inspection', type: 'date', autofill: 'perTest' },
  ],
};
