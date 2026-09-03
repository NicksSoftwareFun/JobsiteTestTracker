import { useEffect, useMemo, useState } from 'react';
import type { Project, Report, SavedDrawing, Template } from '../types';
import { displayDate, downloadBlob, reportDisplayName, uid } from '../utils';
import {
  deleteSavedDrawing,
  exportAllData,
  importAllData,
  saveDrawing,
  type BackupData,
} from '../db';
import { renderDrawingFile } from '../pdf/renderDrawing';
import PdfPagePicker from './PdfPagePicker';
import logoUrl from '../assets/warwick-logo.png';

interface Props {
  reports: Report[];
  templates: Template[];
  savedDrawings: SavedDrawing[];
  projects: Project[];
  onOpen: (id: string) => void;
  onNewReport: (templateId: string) => void;
  onDuplicateReport: (id: string) => void;
  onShareReport: (id: string) => void;
  onNewTemplate: () => void;
  onEditTemplate: (id: string) => void;
  onDuplicateTemplate: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onSavedDrawingsChanged: () => void;
}

type StatusFilter = 'all' | 'draft' | 'completed';

export default function Home({
  reports,
  templates,
  savedDrawings,
  projects,
  onOpen,
  onNewReport,
  onDuplicateReport,
  onShareReport,
  onNewTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteReport,
  onDeleteTemplate,
  onSavedDrawingsChanged,
}: Props) {
  const [picking, setPicking] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // find & organize
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupByProject, setGroupByProject] = useState(false);

  // data safety
  const [storageMB, setStorageMB] = useState<number | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);
  const [dataNote, setDataNote] = useState('');
  const [photosPerPage, setPhotosPerPage] = useState<number>(
    () => Number(localStorage.getItem('qc-photosPerPage')) || 2,
  );

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e && typeof e.usage === 'number') setStorageMB(e.usage / (1024 * 1024));
    });
  }, [reports, savedDrawings, templates]);

  const projectName = (id: string | null) =>
    (id && projects.find((p) => p.id === id)?.name) || 'Unassigned';

  const onUploadFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setPdfFile(file);
      return;
    }
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

  const backupNow = async () => {
    setDataNote('');
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const day = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `warwick-qc-backup-${day}.json`);
    setDataNote('Backup created. Save the downloaded file to OneDrive to keep it safe.');
  };

  const onRestoreFile = async (file: File) => {
    setDataNote('');
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      if (data?.app !== 'warwick-qc' || !Array.isArray(data.reports)) {
        setDataNote('That file is not a valid Warwick QC backup.');
        return;
      }
      setPendingRestore(data);
    } catch {
      setDataNote('Could not read that backup file.');
    }
  };

  const doRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingRestore) return;
    await importAllData(pendingRestore, mode);
    const counts = `${pendingRestore.reports?.length ?? 0} reports, ${pendingRestore.drawings?.length ?? 0} drawings`;
    setPendingRestore(null);
    onSavedDrawingsChanged();
    setDataNote(`Restore complete (${mode}). Loaded ${counts}.`);
  };

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.templateName,
        r.reportTitle ?? '',
        String(r.values['jobNumber'] ?? ''),
        String(r.values['location'] ?? ''),
        displayDate(String(r.values['date'] ?? '')),
        projectName(r.projectId),
        r.status,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, search, statusFilter, projects]);

  const groups = useMemo(() => {
    if (!groupByProject) return null;
    const map = new Map<string, Report[]>();
    for (const r of filteredReports) {
      const key = projectName(r.projectId);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredReports, groupByProject, projects]);

  const reportRow = (r: Report) => (
    <div className="list-item" key={r.id}>
      <div className="meta" onClick={() => onOpen(r.id)} style={{ cursor: 'pointer' }}>
        <div className="name">{reportDisplayName(r.templateName, r.reportTitle)}</div>
        <div className="sub">
          {displayDate(String(r.values['date'] ?? '')) || new Date(r.updatedAt).toLocaleDateString()}
          {r.projectId ? ` · ${projectName(r.projectId)}` : ''}
        </div>
      </div>
      <span className={`badge ${r.status}`}>{r.status}</span>
      <button className="btn sm" onClick={() => onOpen(r.id)}>
        Open
      </button>
      <button className="btn sm" title="Start a new report from this one" onClick={() => onDuplicateReport(r.id)}>
        Copy
      </button>
      <button className="btn sm" title="Share / save this report's PDF" onClick={() => onShareReport(r.id)}>
        Share
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
  );

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

        {reports.length > 0 && (
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="text-input"
              style={{ flex: 1, minWidth: 160 }}
              placeholder="Search job #, location, project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="text-input"
              style={{ maxWidth: 150 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="completed">Completed</option>
            </select>
            <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={groupByProject}
                onChange={(e) => setGroupByProject(e.target.checked)}
              />
              Group by project
            </label>
          </div>
        )}

        {reports.length === 0 && <p className="hint">No reports yet. Tap “New Report” to start.</p>}
        {reports.length > 0 && filteredReports.length === 0 && (
          <p className="hint">No reports match your search.</p>
        )}

        {groups
          ? groups.map(([name, rows]) => (
              <div key={name} style={{ marginBottom: 8 }}>
                <div className="section-title" style={{ marginTop: 6 }}>
                  {name} ({rows.length})
                </div>
                {rows.map(reportRow)}
              </div>
            ))
          : filteredReports.map(reportRow)}
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
              <button className="btn sm" onClick={() => onEditTemplate(t.id)}>
                Edit
              </button>
            )}
            <button className="btn sm" title="Make an editable copy" onClick={() => onDuplicateTemplate(t.id)}>
              Copy
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

      {/* Data safety */}
      <div className="card">
        <h3>Data &amp; Backup</h3>
        <p className="hint">
          Reports are stored on this device. Back up regularly and keep the file in
          OneDrive — then you can restore it here or move everything to another iPad.
        </p>
        <div className="row">
          <button className="btn primary" onClick={backupNow}>
            ⬇ Back Up All Data
          </button>
          <label className="btn navy">
            ⬆ Restore from Backup
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onRestoreFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <div className="field" style={{ marginTop: 12, maxWidth: 260 }}>
          <label>Photos per page in exported PDF</label>
          <select
            className="text-input"
            value={photosPerPage}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPhotosPerPage(v);
              localStorage.setItem('qc-photosPerPage', String(v));
            }}
          >
            <option value={1}>1 per page (largest)</option>
            <option value={2}>2 per page</option>
            <option value={4}>4 per page</option>
          </select>
        </div>
        {storageMB != null && (
          <p className="hint" style={{ marginTop: 10 }}>
            Using about <strong>{storageMB.toFixed(1)} MB</strong> of on-device storage.
            {storageMB > 400 && ' Consider backing up and clearing old reports.'}
          </p>
        )}
        {dataNote && <p className="status-note">{dataNote}</p>}
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

      {pendingRestore && (
        <div className="modal-backdrop" onClick={() => setPendingRestore(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Restore backup</h2>
            <p className="hint">
              This backup has <strong>{pendingRestore.reports?.length ?? 0}</strong> reports and{' '}
              <strong>{pendingRestore.drawings?.length ?? 0}</strong> saved drawings.
              How should it be applied?
            </p>
            <div className="btn-split">
              <button className="btn primary block" onClick={() => doRestore('merge')}>
                Merge (add to current)
              </button>
              <button className="btn navy block" onClick={() => doRestore('replace')}>
                Replace everything
              </button>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn danger sm" onClick={() => setPendingRestore(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
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
