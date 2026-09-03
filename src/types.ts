// Shared data model for the QC / Test Report app.
//
// The app is template-driven: a Template describes the fields of a form, and
// everything else (the editor form, PDF export) is generated from that schema.
// The Pressure Test Record is the first built-in template; users can also build
// their own custom templates with custom fields.

export type FieldType =
  | 'text'
  | 'multiline'
  | 'date'
  | 'time'
  | 'checkboxPair'
  | 'signature'
  | 'photos'
  | 'table';

/** A column in a 'table' field. numeric columns are summed into a total. */
export interface TableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}
export type TableRow = Record<string, string>;

/** Which block a field belongs to for autofill purposes. */
export type AutofillGroup = 'project' | 'perTest';

/** Auto-populated default for a new report. */
export type DefaultValue = 'today' | 'now' | null;

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** 'project' fields are saved to the project and autofilled into new reports. */
  autofill: AutofillGroup;
  default?: DefaultValue;
  /** must be filled before a report can be marked complete */
  required?: boolean;
  /** Labels for the two boxes of a checkboxPair, e.g. ['FIELD', 'SHOP']. */
  options?: [string, string];
  /** columns for a 'table' field */
  columns?: TableColumn[];
}

export interface SectionDef {
  id: string;
  title?: string;
  fieldKeys: string[];
}

export interface Template {
  id: string;
  name: string;
  builtIn: boolean;
  sections: SectionDef[];
  fields: FieldDef[];
  createdAt: number;
}

/** value shapes per field type. 'photos' fields hold an array of PhotoItem
 *  (legacy reports may still hold a plain string[] of data URLs). */
export type CheckboxPairValue = { left: boolean; right: boolean };
export interface PhotoItem {
  src: string;
  caption?: string;
}
export type FieldValue =
  | string
  | CheckboxPairValue
  | string[]
  | PhotoItem[]
  | TableRow[]
  | undefined;

export interface DrawingState {
  /** stable id (used for React keys and per-page markup) */
  id: string;
  /** optional human label, e.g. the source PDF page */
  name?: string;
  /** rendered drawing image (data URL) used as the canvas background */
  backgroundDataUrl: string;
  bgWidth: number;
  bgHeight: number;
  /** fabric.js serialized markup (highlights, text boxes, arrows) */
  fabricJson: unknown | null;
}

/** A reusable drawing page saved to the on-device library (like a template). */
export interface SavedDrawing {
  id: string;
  name: string;
  backgroundDataUrl: string;
  bgWidth: number;
  bgHeight: number;
  createdAt: number;
}

export interface Report {
  id: string;
  templateId: string;
  templateName: string;
  projectId: string | null;
  title: string;
  values: Record<string, FieldValue>;
  /** user-editable title suffix; display = "<templateName> - <reportTitle>" */
  reportTitle?: string;
  /** one or more markup-able drawing pages */
  drawings: DrawingState[];
  /** legacy single-drawing field (migrated into `drawings` on load) */
  drawing?: DrawingState | null;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'completed';
}

export interface Project {
  id: string;
  name: string;
  /** saved admin-block values, used to autofill new reports */
  adminValues: Record<string, FieldValue>;
  /** remembered OneDrive destination note per project (user story 3) */
  oneDriveHint?: string;
  updatedAt: number;
}
