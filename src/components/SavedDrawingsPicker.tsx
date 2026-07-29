import { useEffect, useState } from 'react';
import type { SavedDrawing } from '../types';
import { deleteSavedDrawing, getSavedDrawings } from '../db';

// Pick previously-saved drawing pages (the reusable library) to add to a report.

interface Props {
  onCancel: () => void;
  onPick: (drawings: SavedDrawing[]) => void;
}

export default function SavedDrawingsPicker({ onCancel, onPick }: Props) {
  const [items, setItems] = useState<SavedDrawing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = async () => setItems(await getSavedDrawings());
  useEffect(() => {
    void refresh();
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addSelected = () => onPick(items.filter((d) => selected.has(d.id)));

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Saved drawings</h2>
        {items.length === 0 ? (
          <p className="hint">
            No saved drawings yet. Add pages from a PDF and they'll appear here for
            reuse.
          </p>
        ) : (
          <>
            <p className="hint">Tap drawings to add ({selected.size} selected).</p>
            <div className="page-grid">
              {items.map((d) => (
                <div key={d.id} className={`page-thumb${selected.has(d.id) ? ' selected' : ''}`}>
                  <button className="thumb-hit" onClick={() => toggle(d.id)} type="button">
                    <img src={d.backgroundDataUrl} alt={d.name} />
                    {selected.has(d.id) && <span className="page-check">✓</span>}
                  </button>
                  <span className="page-num">{d.name}</span>
                  <button
                    className="thumb-del"
                    title="Delete from library"
                    onClick={async () => {
                      if (window.confirm(`Delete "${d.name}" from your saved drawings?`)) {
                        await deleteSavedDrawing(d.id);
                        setSelected((p) => {
                          const n = new Set(p);
                          n.delete(d.id);
                          return n;
                        });
                        void refresh();
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="btn danger sm" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={addSelected} disabled={selected.size === 0}>
            Add {selected.size || ''} {selected.size === 1 ? 'drawing' : 'drawings'}
          </button>
        </div>
      </div>
    </div>
  );
}
