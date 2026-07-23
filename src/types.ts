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
  | 'signature';

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
  /** Labels for the two boxes of a checkboxPair, e.g. ['FIELD', 'SHOP']. */
  options?: [string, string];
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

/** value shapes per field type */
export type CheckboxPairValue = { left: boolean; right: boolean };
export type FieldValue = string | CheckboxPairValue | undefined;

export interface DrawingState {
  /** rendered drawing image (data URL) used as the canvas background */
  backgroundDataUrl: string;
  bgWidth: number;
  bgHeight: number;
  /** fabric.js serialized markup (highlights, text boxes, arrows) */
  fabricJson: unknown | null;
}

export interface Report {
  id: string;
  templateId: string;
  templateName: string;
  projectId: string | null;
  title: string;
  values: Record<string, FieldValue>;
  drawing: DrawingState | null;
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
