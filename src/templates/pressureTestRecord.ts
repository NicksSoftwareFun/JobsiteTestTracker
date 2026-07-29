import type { Template } from '../types';

// First built-in template — a faithful digital recreation of the Warwick
// Mechanical Group "PRESSURE TEST RECORD" paper form.
//
// The admin block (autofill: 'project') is saved to the project and autofilled
// into future reports. Date/Start Time default to the current day/time.

export const pressureTestRecord: Template = {
  id: 'builtin.pressure-test-record',
  name: 'Pressure Test Record',
  builtIn: true,
  createdAt: 0,
  sections: [
    {
      id: 'admin',
      title: 'Project / Administrative',
      fieldKeys: [
        'jobNumber',
        'projectManager',
        'generalContractor',
        'contractorPresent',
        'contractDrawing',
      ],
    },
    {
      id: 'test',
      title: 'Test Details',
      fieldKeys: [
        'date',
        'startTime',
        'endTime',
        'location',
        'fieldShop',
        'testMedium',
        'testPressure',
        'actualTestPressure',
        'gaugeNumber',
        'gaugeRange',
        'calibrationDueDate',
      ],
    },
    {
      id: 'description',
      title: 'Brief Description of Test',
      fieldKeys: ['description', 'photos'],
    },
    {
      id: 'signoff',
      title: 'Sign-off',
      fieldKeys: [
        'witnessSignature',
        'secondSignature',
        'fabShopManager',
        'phone',
      ],
    },
  ],
  fields: [
    // --- Administrative block (saved per project, autofilled) ---
    { key: 'jobNumber', label: 'Job Number', type: 'text', autofill: 'project' },
    { key: 'projectManager', label: 'Project Manager', type: 'text', autofill: 'project' },
    { key: 'generalContractor', label: 'General Contractor', type: 'text', autofill: 'project' },
    { key: 'contractorPresent', label: 'Contractor or Vendor Present', type: 'text', autofill: 'project' },
    { key: 'contractDrawing', label: 'Contract Drawing #', type: 'text', autofill: 'project' },

    // --- Test details (per test) ---
    { key: 'date', label: 'Date', type: 'date', autofill: 'perTest', default: 'today' },
    { key: 'startTime', label: 'Start Time', type: 'time', autofill: 'perTest', default: 'now' },
    { key: 'endTime', label: 'End Time', type: 'time', autofill: 'perTest' },
    { key: 'location', label: 'Location', type: 'text', autofill: 'perTest' },
    { key: 'fieldShop', label: 'Field / Shop', type: 'checkboxPair', autofill: 'perTest', options: ['FIELD', 'SHOP'] },
    { key: 'testMedium', label: 'Test Medium', type: 'text', autofill: 'perTest' },
    { key: 'testPressure', label: 'Test Pressure', type: 'text', autofill: 'perTest' },
    { key: 'actualTestPressure', label: 'Actual Test Pressure', type: 'text', autofill: 'perTest' },
    { key: 'gaugeNumber', label: 'Gauge #', type: 'text', autofill: 'perTest' },
    { key: 'gaugeRange', label: 'Gauge Range', type: 'text', autofill: 'perTest' },
    { key: 'calibrationDueDate', label: 'Calibration Due Date', type: 'date', autofill: 'perTest' },

    // --- Description ---
    { key: 'description', label: 'Brief Description of Test', type: 'multiline', autofill: 'perTest' },
    { key: 'photos', label: 'Attach Photos', type: 'photos', autofill: 'perTest' },

    // --- Sign-off ---
    { key: 'witnessSignature', label: 'Witnessed by WMG CQC', type: 'signature', autofill: 'perTest' },
    { key: 'secondSignature', label: 'Additional Signature', type: 'signature', autofill: 'perTest' },
    { key: 'fabShopManager', label: 'WMG Fab Shop Manager', type: 'text', autofill: 'perTest' },
    { key: 'phone', label: 'Phone #', type: 'text', autofill: 'perTest' },
  ],
};
