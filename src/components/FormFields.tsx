import type { CheckboxPairValue, FieldDef, FieldValue, Template } from '../types';
import SignaturePad from './SignaturePad';

// Generic, schema-driven form. Renders any Template's sections and fields, so
// built-in and user-defined custom templates use the exact same UI.

interface Props {
  template: Template;
  values: Record<string, FieldValue>;
  onChange: (key: string, value: FieldValue) => void;
}

export default function FormFields({ template, values, onChange }: Props) {
  return (
    <>
      {template.sections.map((section) => (
        <div className="card" key={section.id}>
          {section.title && <div className="section-title">{section.title}</div>}
          {section.fieldKeys.map((key) => {
            const field = template.fields.find((f) => f.key === key);
            if (!field) return null;
            return (
              <FieldControl
                key={key}
                field={field}
                value={values[key]}
                onChange={(v) => onChange(key, v)}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  switch (field.type) {
    case 'multiline':
      return (
        <div className="field">
          <label>{field.label}</label>
          <textarea
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'date':
      return (
        <div className="field">
          <label>{field.label}</label>
          <input
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'time':
      return (
        <div className="field">
          <label>{field.label}</label>
          <input
            type="time"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'checkboxPair': {
      const v = (value as CheckboxPairValue) ?? { left: false, right: false };
      const opts = field.options ?? ['Option A', 'Option B'];
      return (
        <div className="field">
          <label>{field.label}</label>
          <div className="checkpair">
            <label>
              <input
                type="checkbox"
                checked={v.left}
                onChange={(e) => onChange({ ...v, left: e.target.checked })}
              />
              {opts[0]}
            </label>
            <label>
              <input
                type="checkbox"
                checked={v.right}
                onChange={(e) => onChange({ ...v, right: e.target.checked })}
              />
              {opts[1]}
            </label>
          </div>
        </div>
      );
    }
    case 'signature':
      return (
        <div className="field">
          <label>{field.label}</label>
          <SignaturePad
            value={value as string | undefined}
            onChange={(dataUrl) => onChange(dataUrl)}
          />
        </div>
      );
    default:
      return (
        <div className="field">
          <label>{field.label}</label>
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}
