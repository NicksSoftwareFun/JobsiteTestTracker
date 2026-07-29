import { useEffect, useState } from 'react';
import { renderAllPdfPages, type RenderedDrawing } from '../pdf/renderDrawing';

// Splits an uploaded PDF into pages and lets the user pick one or several to
// use as markup-able drawings.

export type SelectedPage = RenderedDrawing & { pageNumber: number };

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (pages: SelectedPage[]) => void;
}

export default function PdfPagePicker({ file, onCancel, onConfirm }: Props) {
  const [pages, setPages] = useState<RenderedDrawing[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rendered = await renderAllPdfPages(file, 1600, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (!cancelled) setPages(rendered);
      } catch {
        if (!cancelled) setError('Could not read that PDF. If it is password-protected, remove the protection and try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const confirm = () => {
    const chosen = [...selected]
      .sort((a, b) => a - b)
      .map((i) => ({ ...pages[i], pageNumber: i + 1 }));
    onConfirm(chosen);
  };

  const loading = pages.length === 0 && !error;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Select pages to mark up</h2>
        {error && <p className="status-note">{error}</p>}
        {loading && (
          <p className="hint">
            Rendering pages… {progress ? `${progress.done} / ${progress.total}` : ''}
          </p>
        )}

        {!loading && !error && (
          <>
            <p className="hint">
              Tap the pages you want ({selected.size} selected). Each becomes a
              markup-able drawing and is saved to your library for reuse.
            </p>
            <div className="page-grid">
              {pages.map((p, i) => (
                <button
                  key={i}
                  className={`page-thumb${selected.has(i) ? ' selected' : ''}`}
                  onClick={() => toggle(i)}
                  type="button"
                >
                  <img src={p.dataUrl} alt={`Page ${i + 1}`} />
                  <span className="page-num">{i + 1}</span>
                  {selected.has(i) && <span className="page-check">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="btn danger sm" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirm} disabled={selected.size === 0}>
            Add {selected.size || ''} {selected.size === 1 ? 'page' : 'pages'}
          </button>
        </div>
      </div>
    </div>
  );
}
