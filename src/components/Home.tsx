import { useState } from 'react';
import type { Report, SavedDrawing, Template } from '../types';
import { displayDate, uid } from '../utils';
import { deleteSavedDrawing, saveDrawing } from '../db';
import { renderDrawingFile } from '../pdf/renderDrawing';
import PdfPagePicker from './PdfPagePicker';
import logoUrl from '../assets/warwick-logo.png';

interface Props {
  reports: Report[];
  templates: Template[];
  savedDrawings: SavedDrawing[];
  onOpen: (id: string) => void;
  onNewReport: (templateId: string) => void;
  onNewTemplate: () => void;
  onDeleteReport: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onSavedDrawingsChanged: () => void;
}

export default function Home({
  reports,
  templates,
  savedDrawings,
  onOpen,
  onNewReport,
  onNewTemplate,
  onDeleteReport,
  onDeleteTemplate,
  onSavedDrawingsChanged,
}: Props) {
  const [picking, setPicking] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onUploadFile = async (file: File) => {
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setPdfFile(file); // open the page picker
      return;
    }
    // image → save directly as one drawing
    setBusy(true);
    try {
      const r = await renderDrawingFile(file);
      await saveDrawing({
        id: uid('sd_'),
        name: file.name.replace(/\.[^.]+$/, ''),
        backgroundDataUrl: r.dataUrl,
        bgWidth: r.width,
        bgHeight: r.height,
        createdAt: Date.now(),
      });
      onSavedDrawingsChanged();
    } finally {
      setBusy(false);
    }
  };

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

      {/* Saved drawings library */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Saved Drawings</h3>
          <label className={`btn sm navy${busy ? ' disabled' : ''}`}>
            {busy ? 'Uploading…' : '+ Upload drawings'}
            <input
              type="file"
              accept="application/pdf,image/*"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        {savedDrawings.length === 0 ? (
          <p className="hint" style={{ marginTop: 10 }}>
            No saved drawings yet. Upload a PDF (pick pages) or an image — saved pages
            can be added to any report.
          </p>
        ) : (
          <div className="page-grid" style={{ marginTop: 12 }}>
            {savedDrawings.map((d) => (
              <div key={d.id} className="page-thumb">
                <img src={d.backgroundDataUrl} alt={d.name} />
                <span className="page-num">{d.name}</span>
                <button
                  className="thumb-del"
                  title="Delete from library"
                  onClick={async () => {
                    if (confirm(`Delete "${d.name}" from saved drawings?`)) {
                      await deleteSavedDrawing(d.id);
                      onSavedDrawingsChanged();
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pdfFile && (
        <PdfPagePicker
          file={pdfFile}
          onCancel={() => setPdfFile(null)}
          onConfirm={async (pages) => {
            const base = pdfFile.name.replace(/\.pdf$/i, '');
            setPdfFile(null);
            for (const p of pages) {
              await saveDrawing({
                id: uid('sd_'),
                name: `${base} (p${p.pageNumber})`,
                backgroundDataUrl: p.dataUrl,
                bgWidth: p.width,
                bgHeight: p.height,
                createdAt: Date.now(),
              });
            }
            onSavedDrawingsChanged();
          }}
        />
      )}

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
