import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawingState, FieldValue, Project, Report, SavedDrawing, Template } from '../types';
import {
  getProject,
  getProjects,
  getReport,
  saveDrawing,
  saveProject,
  saveReport,
} from '../db';
import { getTemplateById } from '../templates';
import { reportDisplayName, safeFileName, uid } from '../utils';
import { compositeDrawing } from '../pdf/composite';
import { generateReportPdf } from '../pdf/generatePdf';
import FormFields from './FormFields';
import DrawingCanvas from './DrawingCanvas';
import ExportDialog from './ExportDialog';
import PdfPagePicker, { type SelectedPage } from './PdfPagePicker';
import SavedDrawingsPicker from './SavedDrawingsPicker';

/** Migrate legacy single `drawing` into the `drawings` array; ensure ids. */
function normalizeDrawings(r: Report): DrawingState[] {
  const list = r.drawings ?? (r.drawing ? [r.drawing] : []);
  return list.map((d) => ({ ...d, id: d.id || uid('dr_') }));
}

interface Props {
  reportId: string;
  onBack: () => void;
}

export default function ReportEditor({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedNote, setSavedNote] = useState('');
  const [exportState, setExportState] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [pdfPickerFile, setPdfPickerFile] = useState<File | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  // Always-current report, so callbacks captured by children (e.g. the drawing
  // canvas's fabric event listeners, bound once at mount) merge into the latest
  // state instead of an old closure.
  const reportRef = useRef<Report | null>(null);
  const activeIdxRef = useRef(0);
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    void (async () => {
      const r = await getReport(reportId);
      if (!r) return;
      // migrate legacy single drawing → drawings array
      const normalized: Report = { ...r, drawings: normalizeDrawings(r), drawing: null };
      reportRef.current = normalized;
      setReport(normalized);
      setActiveIdx(0);
      setTemplate((await getTemplateById(r.templateId)) ?? null);
      setProjects(await getProjects());
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

  const setReportTitle = (reportTitle: string) => {
    const cur = reportRef.current;
    if (!cur) return;
    persist({ ...cur, reportTitle, updatedAt: Date.now() });
  };

  // Called by DrawingCanvas as the active page's markup/background changes.
  const updateActiveDrawing = (d: DrawingState) => {
    const cur = reportRef.current;
    if (!cur) return;
    const drawings = cur.drawings.map((existing, i) =>
      i === activeIdxRef.current ? { ...d, id: existing.id, name: existing.name } : existing,
    );
    persist({ ...cur, drawings, updatedAt: Date.now() });
  };

  // Append rendered PDF pages as new drawings + save each to the reusable library.
  const addPages = async (pages: SelectedPage[], baseName: string) => {
    const cur = reportRef.current;
    if (!cur) return;
    const newDrawings: DrawingState[] = pages.map((p) => ({
      id: uid('dr_'),
      name: `${baseName} (p${p.pageNumber})`,
      backgroundDataUrl: p.dataUrl,
      bgWidth: p.width,
      bgHeight: p.height,
      fabricJson: null,
    }));
    for (const p of pages) {
      const sd: SavedDrawing = {
        id: uid('sd_'),
        name: `${baseName} (p${p.pageNumber})`,
        backgroundDataUrl: p.dataUrl,
        bgWidth: p.width,
        bgHeight: p.height,
        createdAt: Date.now(),
      };
      await saveDrawing(sd);
    }
    const drawings = [...cur.drawings, ...newDrawings];
    persist({ ...cur, drawings, updatedAt: Date.now() });
    setActiveIdx(drawings.length - newDrawings.length);
  };

  const addSavedDrawings = (saved: SavedDrawing[]) => {
    const cur = reportRef.current;
    if (!cur) return;
    const newDrawings: DrawingState[] = saved.map((s) => ({
      id: uid('dr_'),
      name: s.name,
      backgroundDataUrl: s.backgroundDataUrl,
      bgWidth: s.bgWidth,
      bgHeight: s.bgHeight,
      fabricJson: null,
    }));
    const drawings = [...cur.drawings, ...newDrawings];
    persist({ ...cur, drawings, updatedAt: Date.now() });
    setActiveIdx(drawings.length - newDrawings.length);
  };

  const removeDrawing = (i: number) => {
    const cur = reportRef.current;
    if (!cur) return;
    const drawings = cur.drawings.filter((_, idx) => idx !== i);
    persist({ ...cur, drawings, updatedAt: Date.now() });
    setActiveIdx((a) => Math.max(0, Math.min(a, drawings.length - 1)));
  };

  const applyProjectAdmin = async (p: Project) => {
    const cur = reportRef.current;
    if (!cur) return;
    const merged = { ...cur.values };
    for (const k of adminKeys) {
      if (merged[k] == null || merged[k] === '') merged[k] = p.adminValues[k];
    }
    persist({ ...cur, projectId: p.id, values: merged, updatedAt: Date.now() });
    setSavedNote(`Autofilled admin data from "${p.name}".`);
  };

  const saveAdminData = async () => {
    const cur = reportRef.current;
    if (!cur) return;
    // Name the saved job by Project Name, then Job Number.
    const name =
      String(cur.values['projectName'] ?? '').trim() ||
      String(cur.values['jobNumber'] ?? '').trim() ||
      'Untitled project';
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

  const isBlank = (v: FieldValue) =>
    v == null ||
    v === '' ||
    (Array.isArray(v) && v.length === 0);

  const markSaved = async (status: Report['status']) => {
    const cur = reportRef.current;
    if (!cur || !template) return;
    if (status === 'completed') {
      const missing = template.fields.filter((f) => f.required && isBlank(cur.values[f.key]));
      if (missing.length) {
        setErrorKeys(new Set(missing.map((f) => f.key)));
        setSavedNote(`Please fill required fields before completing: ${missing.map((f) => f.label).join(', ')}.`);
        return;
      }
    }
    setErrorKeys(new Set());
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
      // Composite each drawing page (background + markup) to a flat image.
      const drawingImages: string[] = [];
      for (const d of cur.drawings) {
        if (d.backgroundDataUrl) drawingImages.push(await compositeDrawing(d));
      }
      const photosPerPage = Number(localStorage.getItem('qc-photosPerPage')) || 2;
      const bytes = await generateReportPdf({ template, report: cur, drawingImages, photosPerPage });
      const name = safeFileName(reportDisplayName(template.name, cur.reportTitle)) + '.pdf';
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

      <div className="field" style={{ margin: '4px 0 12px' }}>
        <label>Report title</label>
        <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{template.name} -</span>
          <input
            type="text"
            style={{ flex: 1 }}
            placeholder="e.g. HHW M301.A"
            value={report.reportTitle ?? ''}
            onChange={(e) => setReportTitle(e.target.value)}
          />
        </div>
      </div>

      {/* Load saved job data (admin autofill) */}
      <div className="card">
        <div className="section-title">Load Saved Job</div>
        <div className="field" style={{ maxWidth: 360, marginBottom: 0 }}>
          <label>Autofill admin data from a saved job</label>
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

      <div className="banner">
        <span>💾</span>
        <div className="spacer" style={{ flex: 1 }}>
          <strong>Save admin data to autofill later?</strong>
          <div className="hint">
            Stores Project Name, Job Number, General Contractor, and Project Manager
            for this job so every form autofills them automatically.
          </div>
        </div>
        <button className="btn sm primary" onClick={saveAdminData}>
          Save admin data
        </button>
      </div>

      {savedNote && <p className="hint">{savedNote}</p>}

      {/* Schema-driven form */}
      <FormFields template={template} values={report.values} onChange={setValue} errorKeys={errorKeys} />

      {/* Drawing markup — one or more pages */}
      <div className="card">
        <div className="section-title">Tested Area — Drawings</div>

        <div className="row" style={{ marginBottom: 10 }}>
          <label className="btn sm navy">
            + Add pages from PDF
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPdfPickerFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button className="btn sm" onClick={() => setShowLibrary(true)}>
            + Add from saved drawings
          </button>
        </div>

        {report.drawings.length === 0 ? (
          <p className="hint">
            No drawings yet. Add pages from a PDF (select one or several) or pick from
            your saved drawings. Each page can be marked up and is included in the
            exported PDF.
          </p>
        ) : (
          <>
            {/* page switcher */}
            <div className="drawing-strip">
              {report.drawings.map((d, i) => (
                <div
                  key={d.id}
                  className={`strip-thumb${i === activeIdx ? ' active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                  title={d.name || `Drawing ${i + 1}`}
                >
                  <img src={d.backgroundDataUrl} alt={d.name || `Drawing ${i + 1}`} />
                  <span className="strip-num">{i + 1}</span>
                  <button
                    className="thumb-del"
                    title="Remove page"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Remove this drawing page from the report?'))
                        removeDrawing(i);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {report.drawings[activeIdx] && (
              <DrawingCanvas
                key={report.drawings[activeIdx].id}
                value={report.drawings[activeIdx]}
                onChange={updateActiveDrawing}
              />
            )}
          </>
        )}
      </div>

      {pdfPickerFile && (
        <PdfPagePicker
          file={pdfPickerFile}
          onCancel={() => setPdfPickerFile(null)}
          onConfirm={(pages) => {
            const base = pdfPickerFile.name.replace(/\.pdf$/i, '');
            setPdfPickerFile(null);
            void addPages(pages, base);
          }}
        />
      )}

      {showLibrary && (
        <SavedDrawingsPicker
          onCancel={() => setShowLibrary(false)}
          onPick={(saved) => {
            setShowLibrary(false);
            addSavedDrawings(saved);
          }}
        />
      )}

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
