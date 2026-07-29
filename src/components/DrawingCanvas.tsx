import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Canvas,
  PencilBrush,
  Textbox,
  Line,
  Rect,
  Triangle,
  Group,
  Point,
  FabricImage,
  type FabricObject,
  type TPointerEventInfo,
} from 'fabric';
import type { DrawingState } from '../types';
import { renderDrawingFile } from '../pdf/renderDrawing';
import { compositeDrawing } from '../pdf/composite';

type Tool = 'select' | 'highlight' | 'text' | 'arrow' | 'box' | 'erase' | 'pan';

const COLORS = ['#ffd400', '#35d07f', '#ff5aa5', '#3aa0ff', '#ff4136', '#111111'];

interface Props {
  value: DrawingState | null;
  onChange: (state: DrawingState) => void;
}

/** Serialize markup objects only (background is stored separately as a data URL). */
function serializeObjects(canvas: Canvas): unknown {
  const json = canvas.toObject() as Record<string, unknown>;
  delete json.backgroundImage;
  delete json.background;
  return json;
}

function makeArrow(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  const line = new Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: width,
    strokeLineCap: 'round',
  });
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const head = new Triangle({
    left: x2,
    top: y2,
    originX: 'center',
    originY: 'center',
    angle: angle + 90,
    width: width * 5,
    height: width * 5,
    fill: color,
  });
  const group = new Group([line, head]);
  (group as FabricObject & { markupType?: string }).markupType = 'arrow';
  return group;
}

export default function DrawingCanvas({ value, onChange }: Props) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const bgSizeRef = useRef<{ w: number; h: number }>({ w: 1000, h: 750 });
  const bgDataUrlRef = useRef<string>(value?.backgroundDataUrl ?? '');
  const idRef = useRef<string>(value?.id ?? '');
  const restoringRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const fitZoomRef = useRef(1);

  const toolRef = useRef<Tool>('select');
  const colorRef = useRef<string>(COLORS[0]);
  const sizeRef = useRef<number>(1);

  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [sizeFactor, setSizeFactor] = useState<number>(1);
  const [hasBackground, setHasBackground] = useState<boolean>(!!value?.backgroundDataUrl);

  const emitChange = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    onChange({
      id: idRef.current,
      backgroundDataUrl: bgDataUrlRef.current,
      bgWidth: bgSizeRef.current.w,
      bgHeight: bgSizeRef.current.h,
      fabricJson: serializeObjects(canvas),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || restoringRef.current) return;
    historyRef.current.push(JSON.stringify(serializeObjects(canvas)));
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = []; // a new change invalidates the redo stack
    emitChange();
  }, [emitChange]);

  const highlightWidth = () => Math.max(6, bgSizeRef.current.w * 0.008 * sizeRef.current);
  const arrowWidth = () => Math.max(3, bgSizeRef.current.w * 0.003 * sizeRef.current);
  const textSize = () => Math.max(14, bgSizeRef.current.w * 0.018 * sizeRef.current);

  const fitToScreen = useCallback(() => {
    const canvas = fabricRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    const cw = holder.clientWidth;
    const ch = holder.clientHeight;
    canvas.setDimensions({ width: cw, height: ch });
    const { w, h } = bgSizeRef.current;
    const z = Math.min(cw / w, ch / h);
    fitZoomRef.current = z;
    canvas.setViewportTransform([z, 0, 0, z, (cw - w * z) / 2, (ch - h * z) / 2]);
    canvas.requestRenderAll();
  }, []);

  const applyToolState = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const t = toolRef.current;
    canvas.isDrawingMode = t === 'highlight';
    canvas.selection = t === 'select';
    if (t === 'highlight') {
      const brush = new PencilBrush(canvas);
      // semi-transparent so it reads as a highlighter
      const hex = colorRef.current;
      brush.color = hexToRgba(hex, 0.4);
      brush.width = highlightWidth();
      canvas.freeDrawingBrush = brush;
    }
    canvas.forEachObject((o) => {
      o.selectable = t === 'select';
      o.evented = t === 'select' || t === 'erase';
    });
    canvas.defaultCursor = t === 'pan' ? 'grab' : t === 'erase' ? 'crosshair' : 'default';
    canvas.requestRenderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- init fabric ---
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: '#dfe4ea',
      preserveObjectStacking: true,
      selection: false,
    });
    fabricRef.current = canvas;

    // load background + markup from value
    const init = async () => {
      const w = value?.bgWidth ?? 1000;
      const h = value?.bgHeight ?? 750;
      bgSizeRef.current = { w, h };
      if (value?.fabricJson) {
        restoringRef.current = true;
        await canvas.loadFromJSON(value.fabricJson);
        restoringRef.current = false;
      }
      if (value?.backgroundDataUrl) {
        bgDataUrlRef.current = value.backgroundDataUrl;
        const img = await FabricImage.fromURL(value.backgroundDataUrl);
        img.set({ selectable: false, evented: false });
        canvas.backgroundImage = img;
        setHasBackground(true);
      }
      fitToScreen();
      applyToolState();
      historyRef.current = [JSON.stringify(serializeObjects(canvas))];
    };
    void init();

    // history + change tracking
    canvas.on('object:added', pushHistory);
    canvas.on('object:modified', pushHistory);
    canvas.on('object:removed', pushHistory);

    // arrow/box drawing + text placement + erase + pan
    let arrowStart: { x: number; y: number } | null = null;
    let tempArrow: FabricObject | null = null;
    let boxStart: { x: number; y: number } | null = null;
    let tempBox: Rect | null = null;
    let panning = false;
    let lastPan: { x: number; y: number } | null = null;

    const scenePoint = (opt: TPointerEventInfo) => canvas.getScenePoint(opt.e);

    canvas.on('mouse:down', (opt) => {
      const t = toolRef.current;
      if (t === 'pan') {
        panning = true;
        const p = canvas.getViewportPoint(opt.e);
        lastPan = { x: p.x, y: p.y };
        return;
      }
      if (t === 'erase') {
        if (opt.target) canvas.remove(opt.target);
        return;
      }
      if (t === 'box') {
        const p = scenePoint(opt);
        boxStart = { x: p.x, y: p.y };
        tempBox = new Rect({
          left: p.x,
          top: p.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: colorRef.current,
          strokeWidth: arrowWidth(),
        });
        canvas.add(tempBox);
        return;
      }
      if (t === 'text' && !opt.target) {
        const p = scenePoint(opt);
        const tb = new Textbox('Text', {
          left: p.x,
          top: p.y,
          fontSize: textSize(),
          fill: colorRef.current,
          width: bgSizeRef.current.w * 0.25,
          editable: true,
        });
        canvas.add(tb);
        canvas.setActiveObject(tb);
        setToolAndRefs('select');
        tb.enterEditing();
        tb.selectAll();
        return;
      }
      if (t === 'arrow') {
        const p = scenePoint(opt);
        arrowStart = { x: p.x, y: p.y };
        tempArrow = new Line([p.x, p.y, p.x, p.y], {
          stroke: colorRef.current,
          strokeWidth: arrowWidth(),
          strokeLineCap: 'round',
          selectable: false,
          evented: false,
        });
        canvas.add(tempArrow);
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (panning && lastPan) {
        const p = canvas.getViewportPoint(opt.e);
        canvas.relativePan(new Point(p.x - lastPan.x, p.y - lastPan.y));
        lastPan = { x: p.x, y: p.y };
        return;
      }
      if (toolRef.current === 'arrow' && arrowStart && tempArrow) {
        const p = scenePoint(opt);
        (tempArrow as Line).set({ x2: p.x, y2: p.y });
        canvas.requestRenderAll();
      }
      if (toolRef.current === 'box' && boxStart && tempBox) {
        const p = scenePoint(opt);
        tempBox.set({
          left: Math.min(boxStart.x, p.x),
          top: Math.min(boxStart.y, p.y),
          width: Math.abs(p.x - boxStart.x),
          height: Math.abs(p.y - boxStart.y),
        });
        canvas.requestRenderAll();
      }
    });

    canvas.on('mouse:up', (opt) => {
      if (panning) {
        panning = false;
        lastPan = null;
        return;
      }
      if (toolRef.current === 'arrow' && arrowStart) {
        const p = scenePoint(opt);
        if (tempArrow) {
          canvas.remove(tempArrow);
          tempArrow = null;
        }
        const dist = Math.hypot(p.x - arrowStart.x, p.y - arrowStart.y);
        if (dist > 5) {
          const arrow = makeArrow(
            arrowStart.x,
            arrowStart.y,
            p.x,
            p.y,
            colorRef.current,
            arrowWidth(),
          );
          canvas.add(arrow);
        }
        arrowStart = null;
      }
      if (toolRef.current === 'box' && boxStart) {
        if (tempBox && (tempBox.width < 5 || tempBox.height < 5)) {
          canvas.remove(tempBox);
        }
        tempBox = null;
        boxStart = null;
      }
    });

    // wheel zoom (desktop / trackpad)
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(zoom, fitZoomRef.current * 0.5), fitZoomRef.current * 8);
      canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pinch-to-zoom / two-finger pan
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    let lastDist = 0;
    let lastMid: { x: number; y: number } | null = null;

    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastDist = dist(e.touches);
        lastMid = mid(e.touches);
      }
    };
    const onMove = (e: TouchEvent) => {
      const canvas = fabricRef.current;
      if (!canvas || e.touches.length !== 2) return;
      e.preventDefault();
      const rect = holder.getBoundingClientRect();
      const d = dist(e.touches);
      const m = mid(e.touches);
      const ratio = d / (lastDist || d);
      let zoom = canvas.getZoom() * ratio;
      zoom = Math.min(Math.max(zoom, fitZoomRef.current * 0.5), fitZoomRef.current * 8);
      const pt = new Point(m.x - rect.left, m.y - rect.top);
      canvas.zoomToPoint(pt, zoom);
      if (lastMid) {
        canvas.relativePan(new Point(m.x - lastMid.x, m.y - lastMid.y));
      }
      lastDist = d;
      lastMid = m;
    };
    holder.addEventListener('touchstart', onStart, { passive: false });
    holder.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      holder.removeEventListener('touchstart', onStart);
      holder.removeEventListener('touchmove', onMove);
    };
  }, []);

  const setToolAndRefs = (t: Tool) => {
    toolRef.current = t;
    setTool(t);
    applyToolState();
  };

  const chooseColor = (c: string) => {
    colorRef.current = c;
    setColor(c);
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (active) {
      if (active.type === 'textbox') active.set('fill', c);
      canvas?.requestRenderAll();
      pushHistory();
    }
    applyToolState();
  };

  const changeSize = (f: number) => {
    sizeRef.current = f;
    setSizeFactor(f);
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (active && active.type === 'textbox') {
      (active as Textbox).set('fontSize', textSize());
      canvas?.requestRenderAll();
      pushHistory();
    }
    applyToolState();
  };

  const toggleBold = () => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (active && active.type === 'textbox') {
      const tb = active as Textbox;
      tb.set('fontWeight', tb.fontWeight === 'bold' ? 'normal' : 'bold');
      canvas?.requestRenderAll();
      pushHistory();
    }
  };

  const deleteActive = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const actives = canvas.getActiveObjects();
    actives.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  };

  const loadState = (state: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    restoringRef.current = true;
    void canvas.loadFromJSON(JSON.parse(state)).then(() => {
      canvas.requestRenderAll();
      restoringRef.current = false;
      applyToolState();
      emitChange();
    });
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop()!;
    redoRef.current.push(current);
    loadState(historyRef.current[historyRef.current.length - 1]);
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    const state = redoRef.current.pop()!;
    historyRef.current.push(state);
    loadState(state);
  };

  // Flatten current markup into the background, rotate the page 90°, and start
  // fresh markup on the rotated image (handles sideways scans).
  const rotatePage = async () => {
    const canvas = fabricRef.current;
    if (!canvas || !bgDataUrlRef.current) return;
    const flat = await compositeDrawing({
      id: idRef.current,
      backgroundDataUrl: bgDataUrlRef.current,
      bgWidth: bgSizeRef.current.w,
      bgHeight: bgSizeRef.current.h,
      fabricJson: serializeObjects(canvas),
    });
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = flat;
    });
    const oc = document.createElement('canvas');
    oc.width = img.height;
    oc.height = img.width;
    const ctx = oc.getContext('2d')!;
    ctx.translate(oc.width / 2, oc.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const rotated = oc.toDataURL('image/png');

    canvas.remove(...canvas.getObjects());
    bgSizeRef.current = { w: oc.width, h: oc.height };
    bgDataUrlRef.current = rotated;
    const bg = await FabricImage.fromURL(rotated);
    bg.set({ selectable: false, evented: false });
    canvas.backgroundImage = bg;
    fitToScreen();
    historyRef.current = [JSON.stringify(serializeObjects(canvas))];
    redoRef.current = [];
    emitChange();
  };

  const loadDrawingFile = async (file: File) => {
    const rendered = await renderDrawingFile(file);
    const canvas = fabricRef.current;
    if (!canvas) return;
    bgSizeRef.current = { w: rendered.width, h: rendered.height };
    bgDataUrlRef.current = rendered.dataUrl;
    const img = await FabricImage.fromURL(rendered.dataUrl);
    img.set({ selectable: false, evented: false });
    canvas.backgroundImage = img;
    setHasBackground(true);
    fitToScreen();
    emitChange();
  };

  const zoomBy = (factor: number) => {
    const canvas = fabricRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    let zoom = canvas.getZoom() * factor;
    zoom = Math.min(Math.max(zoom, fitZoomRef.current * 0.5), fitZoomRef.current * 8);
    canvas.zoomToPoint(new Point(holder.clientWidth / 2, holder.clientHeight / 2), zoom);
  };

  return (
    <div className="drawing-wrap">
      <div className="drawing-toolbar">
        <ToolButton label="✋ Pan" active={tool === 'pan'} onClick={() => setToolAndRefs('pan')} />
        <ToolButton label="↖ Select" active={tool === 'select'} onClick={() => setToolAndRefs('select')} />
        <ToolButton label="🖍 Highlight" active={tool === 'highlight'} onClick={() => setToolAndRefs('highlight')} />
        <ToolButton label="🔤 Text" active={tool === 'text'} onClick={() => setToolAndRefs('text')} />
        <ToolButton label="➜ Arrow" active={tool === 'arrow'} onClick={() => setToolAndRefs('arrow')} />
        <ToolButton label="▭ Box" active={tool === 'box'} onClick={() => setToolAndRefs('box')} />
        <ToolButton label="🩹 Eraser" active={tool === 'erase'} onClick={() => setToolAndRefs('erase')} />
        <span className="tool-sep" />
        {COLORS.map((c) => (
          <button
            key={c}
            className="swatch"
            aria-label={`color ${c}`}
            style={{ background: c, outline: color === c ? '2px solid #1f3a5f' : 'none' }}
            onClick={() => chooseColor(c)}
          />
        ))}
        <span className="tool-sep" />
        <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Size
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.5}
            value={sizeFactor}
            onChange={(e) => changeSize(Number(e.target.value))}
          />
        </label>
        <ToolButton label="B" onClick={toggleBold} title="Bold selected text" bold />
        <span className="tool-sep" />
        <ToolButton label="＋" onClick={() => zoomBy(1.25)} title="Zoom in" />
        <ToolButton label="－" onClick={() => zoomBy(0.8)} title="Zoom out" />
        <ToolButton label="⤢ Fit" onClick={fitToScreen} />
        <ToolButton label="⟳ Rotate" onClick={() => void rotatePage()} title="Rotate page 90°" />
        <span className="tool-sep" />
        <ToolButton label="↶ Undo" onClick={undo} />
        <ToolButton label="↷ Redo" onClick={redo} />
        <ToolButton label="🗑 Delete" onClick={deleteActive} />
      </div>
      <div className="canvas-holder" ref={holderRef}>
        <canvas ref={canvasElRef} />
      </div>
      <div className="row" style={{ padding: 8 }}>
        <label className="btn sm">
          {hasBackground ? 'Replace drawing' : 'Load drawing (PDF/image)'}
          <input
            type="file"
            accept="application/pdf,image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadDrawingFile(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <span className="hint">
          Highlight tested areas, add text &amp; arrows. Two-finger pinch to zoom, Pan tool to move.
        </span>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  title,
  bold,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  bold?: boolean;
}) {
  return (
    <button
      className={`tool-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
      style={bold ? { fontWeight: 700 } : undefined}
    >
      {label}
    </button>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
