import type { TableColumn, TableRow } from '../types';

// A simple editable table: fixed columns, add/remove rows, and an auto total
// for any numeric column (e.g. Total Hours).

interface Props {
  label: string;
  columns?: TableColumn[];
  value?: TableRow[];
  onChange: (rows: TableRow[]) => void;
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

export default function TableField({ label, columns = DEFAULT_COLUMNS, value, onChange }: Props) {
  const rows: TableRow[] = Array.isArray(value) && value.every((r) => typeof r === 'object') ? value : [];
  const display = rows.length ? rows : [{}];

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
