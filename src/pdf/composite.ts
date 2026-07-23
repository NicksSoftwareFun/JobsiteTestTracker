// Composite a saved DrawingState (background image + markup objects) into one
// full-resolution PNG for the exported PDF, independent of the live editor.

import { StaticCanvas, FabricImage } from 'fabric';
import type { DrawingState } from '../types';

export async function compositeDrawing(state: DrawingState): Promise<string> {
  const canvas = new StaticCanvas(undefined, {
    width: state.bgWidth,
    height: state.bgHeight,
    enableRetinaScaling: false,
  });
  try {
    if (state.fabricJson) {
      await canvas.loadFromJSON(state.fabricJson);
    }
    const bg = await FabricImage.fromURL(state.backgroundDataUrl);
    bg.set({ left: 0, top: 0, selectable: false, evented: false });
    canvas.backgroundImage = bg;
    canvas.renderAll();
    return canvas.toDataURL({ format: 'png', multiplier: 1 });
  } finally {
    canvas.dispose();
  }
}
