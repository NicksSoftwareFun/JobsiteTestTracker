import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldValue, Project, Report, Template } from '../types';
import {
  getProject,
  getProjects,
  getReport,
  saveProject,
  saveReport,
} from '../db';
import { getTemplateById } from '../templates';
import { uid } from '../utils';
import { compositeDrawing } from '../pdf/composite';
import { generateReportPdf } from '../pdf/generatePdf';
import FormFields from './FormFields';
import DrawingCanvas from './DrawingCanvas';
import ExportDialog from './ExportDialog';

interface Props {
  reportId: string;
  onBack: () => void;
}

function sanitize(s: string) {
  return s.replace(/[^\w\-]+/g, '_').replace(/^_|_$/g, '');
}

export default function ReportEditor({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [exportState, setExportState] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  // Always-current report, so callbacks captured by children (e.g. the drawing
  // canvas's fabric event listeners, bound once at mount) merge into the latest
  // state instead of an old closure.
  const reportRef = useRef<Report | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await getReport(reportId);
      if (!r) return;
      reportRef.current = r;
      setReport(r);
      setTemplate((await getTemplateById(r.templateId)) ?? null);
      setProjects(await getProjects());
      if (r.projectId) {
        const p = await getProject(r.projectId);
        if (p) setProjectName(p.name);
      }
    })();
  }, [reportId]);

  const adminKeys = useMemo(
    () => (template ? template.fields.filter((f) => f.autofill === 'project').map((f) => f.key) : []),
    [template],
  );

  // autosave (debounced). All mutations flow through here and update reportRef
  // synchronously so stale child callbacks still merge into the latest report.
  const persist = (next: Report) => {
    reportRef.current = next;
    setReport(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveReport(next), 400);
  };

  const setValue = (key: string, value: FieldValue) => {
    const cur = reportRef.current;
    if (!cur) return;
    persist({ ...cur, values: { ...cur.values, [key]: value }, updatedAt: Date.now() });
  };

  const setDrawing = (drawing: Report['drawing']) => {
    const cur = reportRef.current;
    if (!cur) return;
    persist({ ...cur, drawing, updatedAt: Date.now() });
  };

  const applyProjectAdmin = async (p: Project) => {
    const cur = reportRef.current;
    if (!cur) return;
    const merged = { ...cur.values };
    for (const k of adminKeys) {
      if (merged[k] == null || merged[k] === '') merged[k] = p.adminValues[k];
    }
    persist({ ...cur, projectId: p.id, values: merged, updatedAt: Date.now() });
    setProjectName(p.name);
    setSavedNote(`Autofilled admin data from "${p.name}".`);
  };

  const saveAdminData = async () => {
    const cur = reportRef.current;
    if (!cur) return;
    const name = projectName.trim() || String(cur.values['jobNumber'] ?? '') || 'Untitled project';
    let project = projects.find((p) => p.name === name) ?? (cur.projectId ? await getProject(cur.projectId) : undefined);
    if (!project) {
      project = { id: uid('proj_'), name, adminValues: {}, updatedAt: Date.now() };
    }
    const adminValues: Record<string, FieldValue> = { ...project.adminValues };
    for (const k of adminKeys) adminValues[k] = cur.values[k];
    const updated: Project = { ...project, name, adminValues, updatedAt: Date.now() };
    await saveProject(updated);
    setProjects(await getProjects());
    persist({ ...cur, projectId: updated.id, updatedAt: Date.now() });
    setSavedNote(`Saved admin data to "${name}" — it will autofill future reports.`);
  };

  const markSaved = async (status: Report['status']) => {
    const cur = reportRef.current;
    if (!cur) return;
    const next = { ...cur, status, updatedAt: Date.now() };
    await saveReport(next);
    persist(next);
    setSavedNote(status === 'completed' ? 'Marked complete & saved.' : 'Saved.');
  };

  const generate = async () => {
    const cur = reportRef.current;
    if (!cur || !template) return;
    setGenerating(true);
    try {
      await saveReport(cur);
      const drawingImageDataUrl = cur.drawing?.backgroundDataUrl
        ? await compositeDrawing(cur.drawing)
        : null;
      const bytes = await generateReportPdf({ template, report: cur, drawingImageDataUrl });
      const job = String(cur.values['jobNumber'] ?? '').trim();
      const name =
        [sanitize(template.name), job && sanitize(job), String(cur.values['date'] ?? '')]
          .filter(Boolean)
          .join('_') + '.pdf';
      setExportState({ bytes, name });
    } finally {
      setGenerating(false);
    }
  };

  if (!report || !template) {
    return <div className="content">Loading…</div>;
  }

  return (
    <div className="content">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={onBack}>
          ← Back
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <span className={`badge ${report.status}`}>{report.status}</span>
        <button className="btn sm" onClick={() => markSaved('draft')}>
          Save draft
        </button>
        <button className="btn sm navy" onClick={() => markSaved('completed')}>
          Mark complete
        </button>
        <button className="btn sm primary" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
      </div>

      <h2 style={{ margin: '4px 0 12px' }}>{template.name}</h2>

      {/* Project selector + admin autofill */}
      <div className="card">
        <div className="section-title">Project</div>
        <div className="grid-2">
          <div className="field">
            <label>Project name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Smithfield VA — Job 3193"
            />
          </div>
          <div className="field">
            <label>Load saved project</label>
            <select
              className="text-input"
              value={report.projectId ?? ''}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                if (p) void applyProjectAdmin(p);
              }}
            >
              <option value="">— none —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="banner">
        <span>💾</span>
        <div className="spacer" style={{ flex: 1 }}>
          <strong>Save admin data to autofill later?</strong>
          <div className="hint">
            Stores Job Number, PM, contractors, and drawing # for this project so your
            next report fills them in automatically.
          </div>
        </div>
        <button className="btn sm primary" onClick={saveAdminData}>
          Save admin data
        </button>
      </div>

      {savedNote && <p className="hint">{savedNote}</p>}

      {/* Schema-driven form */}
      <FormFields template={template} values={report.values} onChange={setValue} />

      {/* Drawing markup */}
      <div className="card">
        <div className="section-title">Tested Area — Drawing Markup</div>
        <DrawingCanvas value={report.drawing} onChange={setDrawing} />
      </div>

      {exportState && (
        <ExportDialog
          pdfBytes={exportState.bytes}
          fileName={exportState.name}
          onClose={() => setExportState(null)}
        />
      )}
    </div>
  );
}
