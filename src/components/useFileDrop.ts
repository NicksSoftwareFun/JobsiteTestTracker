import { useRef, useState, type DragEvent } from 'react';

// Shared drag-and-drop for file sections (attachments, photos, drawings).
// Spread `dropProps` onto the target element, add the `drop-zone` class (plus
// `dragging` while `dragOver`), and render `dropNote` to explain skipped files.

interface Options {
  /** which dropped files this section takes */
  accept: (f: File) => boolean;
  /** called with the accepted files */
  onFiles: (files: File[]) => void;
  /** what this section takes, for the skipped-files note, e.g. "PDFs and images" */
  acceptsLabel: string;
}

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function useFileDrop({ accept, onFiles, acceptsLabel }: Options) {
  const [dragOver, setDragOver] = useState(false);
  const [dropNote, setDropNote] = useState('');
  // dragenter/leave fire for every child element; count to avoid flicker.
  const depth = useRef(0);

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setDragOver(false);
      const all = Array.from(e.dataTransfer.files);
      const ok = all.filter(accept);
      const skipped = all.filter((f) => !ok.includes(f)).map((f) => f.name);
      setDropNote(skipped.length ? `Skipped (only ${acceptsLabel} can go here): ${skipped.join(', ')}` : '');
      if (ok.length) onFiles(ok);
    },
  };

  /** Add a message after the skipped-files note instead of replacing it. */
  const addDropNote = (msg: string) => setDropNote((prev) => (prev ? `${prev} ${msg}` : msg));

  return { dragOver, dropNote, addDropNote, dropProps };
}

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const isImage = (f: File) => f.type.startsWith('image/');
