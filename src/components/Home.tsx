import { useState } from 'react';
import type { Report, Template } from '../types';
import { displayDate } from '../utils';
import logoUrl from '../assets/warwick-logo.png';

interface Props {
  reports: Report[];
  templates: Template[];
  onOpen: (id: string) => void;
  onNewReport: (templateId: string) => void;
  onNewTemplate: () => void;
  onDeleteReport: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export default function Home({
  reports,
  templates,
  onOpen,
  onNewReport,
  onNewTemplate,
  onDeleteReport,
  onDeleteTemplate,
}: Props) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="content">
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={logoUrl} alt="Warwick Mechanical Group" style={{ height: 40 }} />
        <div>
          <h2 style={{ margin: 0 }}>QC Test Reports</h2>
          <div className="hint">Fill a report, mark up the drawing, sign, and export one closeout PDF.</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setPicking(true)}>
          + New Report
        </button>
        <button className="btn" onClick={onNewTemplate}>
          + New Template
        </button>
      </div>

      <div className="card">
        <h3>Reports</h3>
        {reports.length === 0 && <p className="hint">No reports yet. Tap “New Report” to start.</p>}
        {reports.map((r) => (
          <div className="list-item" key={r.id}>
            <div className="meta" onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}>
              <div className="name">
                {r.templateName}
                {r.values['jobNumber'] ? ` — Job ${String(r.values['jobNumber'])}` : ''}
              </div>
              <div className="sub">
                {displayDate(String(r.values['date'] ?? '')) || new Date(r.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <span className={`badge ${r.status}`}>{r.status}</span>
            <button className="btn sm" onClick={() => onOpen(r.id)}>
              Open
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (confirm('Delete this report?')) onDeleteReport(r.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Templates</h3>
        {templates.map((t) => (
          <div className="list-item" key={t.id}>
            <div className="meta">
              <div className="name">{t.name}</div>
              <div className="sub">
                {t.builtIn ? 'Built-in' : 'Custom'} · {t.fields.length} fields
              </div>
            </div>
            <button className="btn sm primary" onClick={() => onNewReport(t.id)}>
              Use
            </button>
            {!t.builtIn && (
              <button
                className="btn sm danger"
                onClick={() => {
                  if (confirm(`Delete template "${t.name}"?`)) onDeleteTemplate(t.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {picking && (
        <div className="modal-backdrop" onClick={() => setPicking(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Choose a form</h2>
            {templates.map((t) => (
              <div className="list-item" key={t.id}>
                <div className="meta">
                  <div className="name">{t.name}</div>
                  <div className="sub">{t.builtIn ? 'Built-in' : 'Custom'}</div>
                </div>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    setPicking(false);
                    onNewReport(t.id);
                  }}
                >
                  Start
                </button>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPicking(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
