import { useState } from 'react';
import type { FieldDef, FieldType, Template } from '../types';
import { uid } from '../utils';

// User story 2: build a custom report template with custom fields — no code.
// The saved template flows through the same form + drawing + PDF pipeline.

interface DraftField {
  id: string;
  label: string;
  type: FieldType;
  autofill: 'project' | 'perTest';
  optA: string;
  optB: string;
  default: '' | 'today' | 'now';
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  multiline: 'Long text',
  date: 'Date',
  time: 'Time',
  checkboxPair: 'Two checkboxes',
  signature: 'Signature',
};

function newField(): DraftField {
  return {
    id: uid('f_'),
    label: '',
    type: 'text',
    autofill: 'perTest',
    optA: 'YES',
    optB: 'NO',
    default: '',
  };
}

interface Props {
  onSave: (t: Template) => void;
  onCancel: () => void;
}

export default function TemplateBuilder({ onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DraftField[]>([
    { ...newField(), label: 'Job Number', autofill: 'project' },
    { ...newField(), label: 'Date', type: 'date', default: 'today' },
  ]);

  const update = (id: string, patch: Partial<DraftField>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => setFields((fs) => fs.filter((f) => f.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setFields((fs) => {
      const i = fs.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const canSave = name.trim().length > 0 && fields.every((f) => f.label.trim());

  const save = () => {
    const built: FieldDef[] = fields.map((f) => {
      const key = f.label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || uid('k_');
      const def: FieldDef = {
        key,
        label: f.label.trim(),
        type: f.type,
        autofill: f.autofill,
      };
      if (f.type === 'checkboxPair') def.options = [f.optA || 'A', f.optB || 'B'];
      if (f.default) def.default = f.default;
      return def;
    });

    const adminKeys = built.filter((_, i) => fields[i].autofill === 'project').map((f) => f.key);
    const restKeys = built.filter((_, i) => fields[i].autofill !== 'project').map((f) => f.key);
    const sections = [];
    if (adminKeys.length)
      sections.push({ id: 'admin', title: 'Project / Administrative', fieldKeys: adminKeys });
    if (restKeys.length) sections.push({ id: 'details', title: 'Details', fieldKeys: restKeys });

    const template: Template = {
      id: uid('tpl.'),
      name: name.trim(),
      builtIn: false,
      createdAt: Date.now(),
      sections,
      fields: built,
    };
    onSave(template);
  };

  return (
    <div className="content">
      <div className="card">
        <h2>New form template</h2>
        <div className="field">
          <label>Template name</label>
          <input
            type="text"
            placeholder="e.g. Ductwork Leakage Test"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <p className="hint">
          Mark a field as <strong>Project</strong> to have it saved per project and
          autofilled into future reports (like Job Number). <strong>Per-test</strong>{' '}
          fields are filled fresh each time. Date/Time fields can auto-fill today's
          date and the current time.
        </p>
      </div>

      <div className="card">
        <div className="section-title">Fields</div>
        {fields.map((f) => (
          <div key={f.id} style={{ borderBottom: '1px solid #eef0f3', paddingBottom: 10, marginBottom: 10 }}>
            <div className="builder-field">
              <input
                type="text"
                className="text-input"
                placeholder="Field label"
                value={f.label}
                onChange={(e) => update(f.id, { label: e.target.value })}
              />
              <select
                className="text-input"
                value={f.type}
                onChange={(e) => update(f.id, { type: e.target.value as FieldType })}
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                className="text-input"
                value={f.autofill}
                onChange={(e) => update(f.id, { autofill: e.target.value as 'project' | 'perTest' })}
              >
                <option value="perTest">Per-test</option>
                <option value="project">Project</option>
              </select>
              <div className="row">
                <button className="btn sm" onClick={() => move(f.id, -1)} title="Move up">
                  ↑
                </button>
                <button className="btn sm" onClick={() => move(f.id, 1)} title="Move down">
                  ↓
                </button>
                <button className="btn sm danger" onClick={() => remove(f.id)}>
                  ✕
                </button>
              </div>
            </div>
            {f.type === 'checkboxPair' && (
              <div className="row">
                <input
                  className="text-input"
                  style={{ maxWidth: 140 }}
                  value={f.optA}
                  onChange={(e) => update(f.id, { optA: e.target.value })}
                  placeholder="Checkbox 1"
                />
                <input
                  className="text-input"
                  style={{ maxWidth: 140 }}
                  value={f.optB}
                  onChange={(e) => update(f.id, { optB: e.target.value })}
                  placeholder="Checkbox 2"
                />
              </div>
            )}
            {(f.type === 'date' || f.type === 'time') && (
              <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!f.default}
                  onChange={(e) =>
                    update(f.id, {
                      default: e.target.checked ? (f.type === 'date' ? 'today' : 'now') : '',
                    })
                  }
                />
                Auto-fill {f.type === 'date' ? "today's date" : 'current time'}
              </label>
            )}
          </div>
        ))}
        <button className="btn sm" onClick={() => setFields((fs) => [...fs, newField()])}>
          + Add field
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!canSave}>
          Save template
        </button>
      </div>
    </div>
  );
}
