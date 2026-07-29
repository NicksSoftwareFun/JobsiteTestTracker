import { useRef } from 'react';
import type { PhotoItem } from '../types';
import { normalizePhotos } from '../utils';

// Attach photos to a report: choose from the library or (on devices with a
// camera) take one. Images are downscaled + JPEG-compressed to keep storage
// small. On desktop/Windows without a touch camera, the "Take Photo" button is
// greyed out. Each photo can have an optional caption.

interface Props {
  value?: string[] | PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
}

// A coarse pointer (finger) is a good proxy for a phone/tablet with a usable
// rear camera. Desktop mice report "fine" → camera capture greyed out.
const HAS_CAMERA =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

function compress(file: File, maxEdge = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoField({ value, onChange }: Props) {
  const photos: PhotoItem[] = normalizePhotos(value);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: PhotoItem[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push({ src: await compress(f) });
      } catch {
        /* skip unreadable image */
      }
    }
    if (added.length) onChange([...photos, ...added]);
  };

  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i));
  const setCaption = (i: number, caption: string) =>
    onChange(photos.map((p, idx) => (idx === i ? { ...p, caption } : p)));

  return (
    <div className="field">
      <label>Attach Photos</label>
      <div className="row">
        <button className="btn sm" type="button" onClick={() => galleryRef.current?.click()}>
          🖼 Choose Photo
        </button>
        <button
          className="btn sm"
          type="button"
          disabled={!HAS_CAMERA}
          title={HAS_CAMERA ? 'Take a photo' : 'Camera not available on this device'}
          onClick={() => cameraRef.current?.click()}
        >
          📷 Take Photo
        </button>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.currentTarget.value = '';
        }}
      />

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div className="photo-thumb" key={i}>
              <img src={p.src} alt={`Photo ${i + 1}`} />
              <button className="thumb-del" onClick={() => remove(i)} title="Remove photo">
                ✕
              </button>
              <input
                type="text"
                className="photo-caption"
                placeholder="Caption…"
                value={p.caption ?? ''}
                onChange={(e) => setCaption(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
      {!HAS_CAMERA && (
        <p className="hint">Camera capture isn't available here — use “Choose Photo”.</p>
      )}
    </div>
  );
}
