import { useState } from 'react';
import type { SavedList, TableColumn, TableRow } from '../types';

// A simple editable table: fixed columns, add/remove rows, and an auto total
// for any numeric column (e.g. Total Hours). When save/load handlers are
// provided, the current rows can be saved as a named list (e.g. a crew roster)
// and reloaded into any report independently of the admin data.

interface Props {
  label: string;
  columns?: TableColumn[];
  value?: TableRow[];
  onChange: (rows: TableRow[]) => void;
  /** saved named lists for this table field (enables the save/load toolbar) */
  savedLists?: SavedList[];
  onSaveList?: (name: string, rows: TableRow[]) => void;
  onDeleteList?: (id: string) => void;
}

const DEFAULT_COLUMNS: TableColumn[] = [
  { key: 'item', label: 'Item' },
  { key: 'qty', label: 'Qty', numeric: true },
  { key: 'notes', label: 'Notes' },
];

function sumColumn(rows: TableRow[], key: string): number {
  return rows.reduce((acc, r) => {
    const n = parseFloat((r[key] ?? '').replace(/[^0-9.\-]/g, ''));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function TableField({
  label,
  columns = DEFAULT_COLUMNS,
  value,
  onChange,
  savedLists,
  onSaveList,
  onDeleteList,
}: Props) {
  const [selectedListId, setSelectedListId] = useState('');
  const rows: TableRow[] = Array.isArray(value) && value.every((r) => typeof r === 'object') ? value : [];
  const display = rows.length ? rows : [{}];

  // A row is "real" if any cell has content — used to avoid saving an empty list.
  const nonEmptyRows = rows.filter((r) => Object.values(r).some((c) => String(c ?? '').trim()));
  const savingEnabled = !!onSaveList;

  const handleSave = () => {
    if (!onSaveList) return;
    if (!nonEmptyRows.length) {
      alert('Add at least one row before saving this list.');
      return;
    }
    const name = prompt(`Save "${label}" as a named list (e.g. "Day crew"):`)?.trim();
    if (name) onSaveList(name, nonEmptyRows);
  };

  const handleLoad = (id: string) => {
    setSelectedListId(id);
    const list = savedLists?.find((l) => l.id === id);
    if (list) onChange(list.rows.map((r) => ({ ...r })));
  };

  const handleDelete = () => {
    if (!onDeleteList || !selectedListId) return;
    const list = savedLists?.find((l) => l.id === selectedListId);
    if (list && confirm(`Delete saved list "${list.name}"?`)) {
      onDeleteList(selectedListId);
      setSelectedListId('');
    }
  };

  const setCell = (rowIdx: number, key: string, v: string) => {
    const next = display.map((r, i) => (i === rowIdx ? { ...r, [key]: v } : r));
    onChange(next);
  };
  const addRow = () => onChange([...display, {}]);
  const removeRow = (i: number) => {
    const next = display.filter((_, idx) => idx !== i);
    onChange(next);
  };

  const gridCols = columns.map((c) => (c.numeric ? '90px' : 'minmax(90px, 1fr)')).join(' ') + ' 36px';
  const numericCols = columns.filter((c) => c.numeric);

  return (
    <div className="field">
      <label>{label}</label>

      {savingEnabled && (
        <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="text-input"
            style={{ maxWidth: 220 }}
            value={selectedListId}
            onChange={(e) => handleLoad(e.target.value)}
          >
            <option value="">Load saved list…</option>
            {(savedLists ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.rows.length})
              </option>
            ))}
          </select>
          {selectedListId && onDeleteList && (
            <button className="btn sm danger" type="button" onClick={handleDelete} title="Delete the selected saved list">
              Delete saved
            </button>
          )}
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn sm navy" type="button" onClick={handleSave}>
            💾 Save list
          </button>
        </div>
      )}

      <div className="table-field">
        <div className="table-scroll">
          <div className="trow thead" style={{ gridTemplateColumns: gridCols }}>
            {columns.map((c) => (
              <div className="tcell" key={c.key}>
                {c.label}
              </div>
            ))}
            <div className="tcell" />
          </div>

          {display.map((r, ri) => (
            <div className="trow" key={ri} style={{ gridTemplateColumns: gridCols }}>
              {columns.map((c) => (
                <input
                  key={c.key}
                  className="tcell-input"
                  inputMode={c.numeric ? 'decimal' : 'text'}
                  value={r[c.key] ?? ''}
                  onChange={(e) => setCell(ri, c.key, e.target.value)}
                />
              ))}
              <button
                className="trow-del"
                title="Remove row"
                onClick={() => removeRow(ri)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <button className="btn sm" type="button" onClick={addRow}>
            + Add row
          </button>
          {numericCols.length > 0 && (
            <div className="table-totals">
              {numericCols.map((c) => (
                <span key={c.key}>
                  Total {c.label}: <strong>{fmt(sumColumn(display, c.key))}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
