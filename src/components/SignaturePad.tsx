import { useEffect, useRef, useState } from 'react';

// Signature capture with two input methods:
//  - Draw: finger/stylus/mouse mark on a canvas (best on iPad).
//  - Type: computer users type their name; it's rendered in a script font with
//    a "Signed <date/time>" stamp. (A browser PWA cannot access installed
//    certificates, so this is a typed e-signature, not a PKI signature.)
// Both emit a transparent PNG data URL, so storage and PDF export are identical.

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

const SCRIPT_FONT = 'italic 52px "Segoe Script","Bradley Hand","Snell Roundhand","Brush Script MT",cursive';

/** Render a typed name (+ timestamp) to a transparent PNG data URL. */
function renderTypedSignature(name: string): string {
  const W = 620;
  const H = 170;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.textAlign = 'center';

  // Name in a signature-style script.
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'alphabetic';
  ctx.font = SCRIPT_FONT;
  ctx.fillText(name, W / 2, H / 2 + 8);

  // Underline rule.
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, H / 2 + 26);
  ctx.lineTo(W - 40, H / 2 + 26);
  ctx.stroke();

  // Timestamp so the typed mark carries when it was applied.
  ctx.fillStyle = '#555';
  ctx.font = '16px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(`Signed ${new Date().toLocaleString()}`, W / 2, H - 20);

  return c.toDataURL('image/png');
}

export default function SignaturePad({ value, onChange }: Props) {
  // Default to Type on non-touch (computer) devices, Draw on touch (iPad).
  const [mode, setMode] = useState<'draw' | 'type'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'draw' : 'type',
  );
  const [typedName, setTypedName] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  // Draw-canvas setup (only mounted in draw mode); pre-loads an existing value.
  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const pos = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const down = (e: PointerEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      lastRef.current = pos(e);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const p = pos(e);
      const last = lastRef.current!;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      dirtyRef.current = true;
    };
    const up = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (dirtyRef.current) onChange(canvas.toDataURL('image/png'));
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, mode]);

  const clearDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
    onChange(undefined);
  };

  const onType = (name: string) => {
    setTypedName(name);
    onChange(name.trim() ? renderTypedSignature(name.trim()) : undefined);
  };

  const clearType = () => {
    setTypedName('');
    onChange(undefined);
  };

  return (
    <div>
      <div className="sig-modes" role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          className={`btn sm${mode === 'draw' ? ' primary' : ''}`}
          onClick={() => setMode('draw')}
        >
          ✍️ Draw
        </button>
        <button
          type="button"
          className={`btn sm${mode === 'type' ? ' primary' : ''}`}
          onClick={() => setMode('type')}
        >
          ⌨️ Type
        </button>
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas ref={canvasRef} className="sig-pad" />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn sm" onClick={clearDraw} type="button">
              Clear signature
            </button>
            <span className="hint">Sign above with your finger or stylus.</span>
          </div>
        </div>
      ) : (
        <div>
          <input
            type="text"
            className="text-input sig-type-input"
            placeholder="Type your full name to sign"
            value={typedName}
            onChange={(e) => onType(e.target.value)}
            style={{ fontFamily: '"Segoe Script","Bradley Hand","Snell Roundhand","Brush Script MT",cursive', fontStyle: 'italic', fontSize: 26 }}
          />
          {value && (
            <img
              src={value}
              alt="Typed signature preview"
              style={{ display: 'block', marginTop: 8, maxWidth: '100%', height: 90, objectFit: 'contain' }}
            />
          )}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn sm" onClick={clearType} type="button">
              Clear signature
            </button>
            <span className="hint">
              Type your name to sign. A date/time stamp is added automatically.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
