import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Report, SavedDrawing, Template } from './types';
import {
  deleteReport as dbDeleteReport,
  deleteTemplate as dbDeleteTemplate,
  getProjects,
  getReports,
  getSavedDrawings,
  saveReport,
  saveTemplate,
} from './db';
import { getAllTemplates, getTemplateById } from './templates';
import { getReport } from './db';
import { todayISO, nowTime, todayWeekday, uid } from './utils';
import { buildReportPdf } from './pdf/report';
import Home from './components/Home';
import ReportEditor from './components/ReportEditor';
import TemplateBuilder from './components/TemplateBuilder';
import ExportDialog from './components/ExportDialog';
import { applyPendingUpdate, setUpdateGuard } from './update';

type View =
  | { name: 'home' }
  | { name: 'editor'; reportId: string }
  | { name: 'builder'; templateId?: string; keepId?: boolean };

type Theme = 'light' | 'dark';

// "Give Feedback" opens the device's default mail app with a prefilled message
// addressed to the developer. Shown in the top bar on every screen.
const FEEDBACK_EMAIL = 'nvanriper@wphcorp.com';
const FEEDBACK_SUBJECT = 'Warwick QC Test Reports — Feedback';
const FEEDBACK_BODY = [
  'Thanks for trying the Warwick QC Test Reports app. Please share your feedback below:',
  '',
  'What works well:',
  '',
  'What could be improved / bugs:',
  '',
  'Feature requests:',
  '',
  '',
  '(Device / iPad model, if relevant:)',
].join('\n');
const feedbackMailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
  FEEDBACK_SUBJECT,
)}&body=${encodeURIComponent(FEEDBACK_BODY)}`;

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shareExport, setShareExport] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('qc-theme') as Theme) || 'light',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qc-theme', theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    setReports(await getReports());
    setTemplates(await getAllTemplates());
    setSavedDrawings(await getSavedDrawings());
    setProjects(await getProjects());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // App updates reload the page only from the Home screen (never mid-report).
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => setUpdateGuard(() => viewRef.current.name === 'home'), []);
  useEffect(() => {
    if (view.name === 'home' && !shareExport) applyPendingUpdate();
  }, [view, shareExport]);

  const newReport = async (templateId: string) => {
    const template = await getTemplateById(templateId);
    if (!template) return;
    const values: Report['values'] = {};
    for (const f of template.fields) {
      if (f.default === 'today') values[f.key] = todayISO();
      else if (f.default === 'now') values[f.key] = nowTime();
      else if (f.default === 'weekday') values[f.key] = todayWeekday();
    }
    // New reports start with no drawings; the foreman adds plan pages as needed.
    const drawings: Report['drawings'] = [];
    const report: Report = {
      id: uid('rep_'),
      templateId: template.id,
      templateName: template.name,
      projectId: null,
      title: template.name,
      reportTitle: '',
      values,
      drawings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
    };
    await saveReport(report);
    await refresh();
    setView({ name: 'editor', reportId: report.id });
  };

  // Duplicate an existing report as a fresh draft (fields copied; per-test
  // specifics reset). Drawings start empty; add from the saved library.
  const duplicateReport = async (reportId: string) => {
    const orig = await getReport(reportId);
    if (!orig) return;
    const template = await getTemplateById(orig.templateId);
    const values: Report['values'] = { ...orig.values };
    for (const f of template?.fields ?? []) {
      if (f.type === 'signature') delete values[f.key];
      else if (f.type === 'photos') values[f.key] = [];
      else if (f.default === 'today') values[f.key] = todayISO();
      else if (f.default === 'now') values[f.key] = nowTime();
      else if (f.default === 'weekday') values[f.key] = todayWeekday();
    }
    const report: Report = {
      ...orig,
      id: uid('rep_'),
      values,
      drawings: [],
      drawing: null,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveReport(report);
    await refresh();
    setView({ name: 'editor', reportId: report.id });
  };

  // Share a report straight from the list (same as sharing from the editor).
  const shareReport = async (id: string) => {
    const r = await getReport(id);
    if (!r) return;
    const t = await getTemplateById(r.templateId);
    if (!t) return;
    const { bytes, name } = await buildReportPdf(r, t);
    setShareExport({ bytes, name });
  };

  const handleSaveTemplate = async (t: Template) => {
    await saveTemplate(t);
    await refresh();
    setView({ name: 'home' });
  };

  const handleDeleteReport = async (id: string) => {
    await dbDeleteReport(id);
    await refresh();
  };

  const handleDeleteTemplate = async (id: string) => {
    await dbDeleteTemplate(id);
    await refresh();
  };

  const goHome = async () => {
    await refresh();
    setView({ name: 'home' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">Warwick QC</span>
        <span className="spacer" />
        <a
          className="btn ghost sm"
          href={feedbackMailto}
          title="Email feedback to the developer"
        >
          ✉ Feedback
        </a>
        <button
          className="btn ghost sm theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        {view.name === 'builder' && (
          <button className="btn ghost sm" onClick={goHome}>
            Home
          </button>
        )}
      </header>

      {view.name === 'home' && (
        <Home
          reports={reports}
          templates={templates}
          savedDrawings={savedDrawings}
          projects={projects}
          onOpen={(id) => setView({ name: 'editor', reportId: id })}
          onNewReport={newReport}
          onDuplicateReport={duplicateReport}
          onShareReport={shareReport}
          onNewTemplate={() => setView({ name: 'builder' })}
          onEditTemplate={(id) => setView({ name: 'builder', templateId: id, keepId: true })}
          onDuplicateTemplate={(id) => setView({ name: 'builder', templateId: id, keepId: false })}
          onDeleteReport={handleDeleteReport}
          onDeleteTemplate={handleDeleteTemplate}
          onSavedDrawingsChanged={refresh}
        />
      )}

      {view.name === 'editor' && (
        <ReportEditor reportId={view.reportId} onBack={goHome} />
      )}

      {view.name === 'builder' && (
        <TemplateBuilder
          initial={view.templateId ? templates.find((t) => t.id === view.templateId) : undefined}
          keepId={view.keepId}
          onSave={handleSaveTemplate}
          onCancel={() => setView({ name: 'home' })}
        />
      )}

      {shareExport && (
        <ExportDialog
          pdfBytes={shareExport.bytes}
          fileName={shareExport.name}
          onClose={() => setShareExport(null)}
        />
      )}
    </div>
  );
}
