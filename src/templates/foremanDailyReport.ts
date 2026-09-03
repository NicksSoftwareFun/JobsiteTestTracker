import type { Template } from '../types';
import { adminFields, adminSection } from './adminBlock';

// Built-in template from the Warwick "Daily Construction Report" (Foreman Daily
// Report). Uses the shared admin block; the daily header and the labor /
// subcontractor / equipment lists are form-specific sections.
//
// The labor and subcontractor lists are free-text areas (one entry per line)
// since the app has no table field type yet.

export const foremanDailyReport: Template = {
  id: 'builtin.foreman-daily-report',
  name: 'Foreman Daily Report',
  builtIn: true,
  createdAt: 0,
  sections: [
    adminSection,
    {
      id: 'day',
      title: 'Day',
      fieldKeys: ['date', 'foreman', 'dayOfWeek', 'weather', 'highLowTemp', 'precipitation'],
    },
    {
      id: 'labor',
      title: 'Warwick Labor On Site',
      fieldKeys: ['warwickLabor'],
    },
    {
      id: 'subs',
      title: 'Subcontractors On Site',
      fieldKeys: ['subcontractorsOnSite'],
    },
    {
      id: 'equipment',
      title: 'Equipment / System Tests and Start-ups',
      fieldKeys: ['equipmentTests'],
    },
    {
      id: 'photos',
      title: 'Photographic Record',
      fieldKeys: ['photos'],
    },
    {
      id: 'signoff',
      title: 'Sign-off',
      fieldKeys: ['foremanSignature'],
    },
  ],
  fields: [
    ...adminFields,

    // Daily header
    { key: 'date', label: 'Date', type: 'date', autofill: 'perTest', default: 'today', required: true },
    { key: 'foreman', label: 'Foreman', type: 'text', autofill: 'perTest' },
    { key: 'dayOfWeek', label: 'Day of the Week', type: 'text', autofill: 'perTest' },
    { key: 'weather', label: 'Weather', type: 'text', autofill: 'perTest' },
    { key: 'highLowTemp', label: 'High / Low Temp', type: 'text', autofill: 'perTest' },
    { key: 'precipitation', label: 'Precipitation', type: 'text', autofill: 'perTest' },

    // Labor (table with auto Total Hours)
    {
      key: 'warwickLabor',
      label: 'Warwick Labor On Site',
      type: 'table',
      autofill: 'perTest',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'hours', label: 'Hours', numeric: true },
        { key: 'notes', label: 'Notes' },
      ],
    },

    // Subcontractors (table with auto total personnel)
    {
      key: 'subcontractorsOnSite',
      label: 'Subcontractors On Site',
      type: 'table',
      autofill: 'perTest',
      columns: [
        { key: 'company', label: 'Company' },
        { key: 'personnel', label: 'Personnel', numeric: true },
        { key: 'notes', label: 'Notes' },
      ],
    },

    // Equipment
    { key: 'equipmentTests', label: 'Equipment / System Tests and Start-ups', type: 'multiline', autofill: 'perTest' },

    // Photos + sign-off
    { key: 'photos', label: 'Photographic Record(s)', type: 'photos', autofill: 'perTest' },
    { key: 'foremanSignature', label: 'Foreman Signature', type: 'signature', autofill: 'perTest' },
  ],
};
