import { useCallback, useEffect, useState } from 'react';
import type { Report, Template } from './types';
import {
  deleteReport as dbDeleteReport,
  deleteTemplate as dbDeleteTemplate,
  getReports,
  saveReport,
  saveTemplate,
} from './db';
import { getAllTemplates, getTemplateById } from './templates';
import { todayISO, nowTime, uid } from './utils';
import { renderDrawingUrl } from './pdf/renderDrawing';
import Home from './components/Home';
import ReportEditor from './components/ReportEditor';
import TemplateBuilder from './components/TemplateBuilder';
import sampleDrawingUrl from './data/sample-drawing.png';

type View = { name: 'home' } | { name: 'editor'; reportId: string } | { name: 'builder' };

type Theme = 'light' | 'dark';

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const newReport = async (templateId: string) => {
    const template = await getTemplateById(templateId);
    if (!template) return;
    const values: Report['values'] = {};
    for (const f of template.fields) {
      if (f.default === 'today') values[f.key] = todayISO();
      else if (f.default === 'now') values[f.key] = nowTime();
    }
    // Bundle the sample drawing so the app is testable immediately.
    const drawings: Report['drawings'] = [];
    try {
      const rendered = await renderDrawingUrl(sampleDrawingUrl);
      drawings.push({
        id: uid('dr_'),
        name: 'Sample drawing',
        backgroundDataUrl: rendered.dataUrl,
        bgWidth: rendered.width,
        bgHeight: rendered.height,
        fabricJson: null,
      });
    } catch {
      /* sample optional */
    }
    const report: Report = {
      id: uid('rep_'),
      templateId: template.id,
      templateName: template.name,
      projectId: null,
      title: template.name,
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
        <button
          className="btn ghost sm theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
        {view.name !== 'home' && (
          <button className="btn ghost sm" onClick={goHome}>
            Home
          </button>
        )}
      </header>

      {view.name === 'home' && (
        <Home
          reports={reports}
          templates={templates}
          onOpen={(id) => setView({ name: 'editor', reportId: id })}
          onNewReport={newReport}
          onNewTemplate={() => setView({ name: 'builder' })}
          onDeleteReport={handleDeleteReport}
          onDeleteTemplate={handleDeleteTemplate}
        />
      )}

      {view.name === 'editor' && (
        <ReportEditor reportId={view.reportId} onBack={goHome} />
      )}

      {view.name === 'builder' && (
        <TemplateBuilder onSave={handleSaveTemplate} onCancel={() => setView({ name: 'home' })} />
      )}
    </div>
  );
}
