// IndexedDB persistence via idb. Stores in-progress and completed reports,
// per-project admin data (for autofill), and user-defined templates. This is the
// on-device "local storage" layer; finished PDFs are exported out to OneDrive.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, Report, SavedDrawing, Template } from '../types';

interface QCDB extends DBSchema {
  projects: { key: string; value: Project };
  reports: { key: string; value: Report; indexes: { byUpdated: number } };
  templates: { key: string; value: Template };
  drawings: { key: string; value: SavedDrawing };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<QCDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<QCDB>('qc-test-tracker', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('projects', { keyPath: 'id' });
          const reports = db.createObjectStore('reports', { keyPath: 'id' });
          reports.createIndex('byUpdated', 'updatedAt');
          db.createObjectStore('templates', { keyPath: 'id' });
          db.createObjectStore('settings');
        }
        if (oldVersion < 2) {
          db.createObjectStore('drawings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// --- Projects ---
export async function getProjects(): Promise<Project[]> {
  const db = await getDB();
  return (await db.getAll('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getProject(id: string) {
  return (await getDB()).get('projects', id);
}
export async function saveProject(p: Project) {
  await (await getDB()).put('projects', p);
}

// --- Reports ---
export async function getReports(): Promise<Report[]> {
  const db = await getDB();
  return (await db.getAll('reports')).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getReport(id: string) {
  return (await getDB()).get('reports', id);
}
export async function saveReport(r: Report) {
  await (await getDB()).put('reports', r);
}
export async function deleteReport(id: string) {
  await (await getDB()).delete('reports', id);
}

// --- User-defined templates ---
export async function getUserTemplates(): Promise<Template[]> {
  const db = await getDB();
  return (await db.getAll('templates')).sort((a, b) => a.createdAt - b.createdAt);
}
export async function saveTemplate(t: Template) {
  await (await getDB()).put('templates', t);
}
export async function deleteTemplate(id: string) {
  await (await getDB()).delete('templates', id);
}

// --- Saved drawings library ---
export async function getSavedDrawings(): Promise<SavedDrawing[]> {
  const db = await getDB();
  return (await db.getAll('drawings')).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveDrawing(d: SavedDrawing) {
  await (await getDB()).put('drawings', d);
}
export async function deleteSavedDrawing(id: string) {
  await (await getDB()).delete('drawings', id);
}

// --- Settings ---
export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await getDB()).get('settings', key) as Promise<T | undefined>;
}
export async function setSetting(key: string, value: unknown) {
  await (await getDB()).put('settings', value, key);
}

// --- Backup / Restore (all data in one file) ---
export interface BackupData {
  app: 'warwick-qc';
  version: number;
  exportedAt: number;
  projects: Project[];
  reports: Report[];
  templates: Template[];
  drawings: SavedDrawing[];
  settings: { key: string; value: unknown }[];
}

export async function exportAllData(): Promise<BackupData> {
  const db = await getDB();
  const [projects, reports, templates, drawings] = await Promise.all([
    db.getAll('projects'),
    db.getAll('reports'),
    db.getAll('templates'),
    db.getAll('drawings'),
  ]);
  const settingKeys = await db.getAllKeys('settings');
  const settings = await Promise.all(
    settingKeys.map(async (k) => ({ key: String(k), value: await db.get('settings', k) })),
  );
  return { app: 'warwick-qc', version: 1, exportedAt: Date.now(), projects, reports, templates, drawings, settings };
}

export async function importAllData(data: BackupData, mode: 'merge' | 'replace') {
  const db = await getDB();
  const tx = db.transaction(['projects', 'reports', 'templates', 'drawings', 'settings'], 'readwrite');
  if (mode === 'replace') {
    await Promise.all([
      tx.objectStore('projects').clear(),
      tx.objectStore('reports').clear(),
      tx.objectStore('templates').clear(),
      tx.objectStore('drawings').clear(),
      tx.objectStore('settings').clear(),
    ]);
  }
  for (const p of data.projects ?? []) await tx.objectStore('projects').put(p);
  for (const r of data.reports ?? []) await tx.objectStore('reports').put(r);
  for (const t of data.templates ?? []) {
    if (!t.builtIn) await tx.objectStore('templates').put(t); // built-ins live in code
  }
  for (const d of data.drawings ?? []) await tx.objectStore('drawings').put(d);
  for (const s of data.settings ?? []) await tx.objectStore('settings').put(s.value, s.key);
  await tx.done;
}
