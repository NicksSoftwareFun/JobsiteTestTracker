import { useState } from 'react';
import { appendReportToLog } from '../pdf/appendToLog';

// User story 3: after generating the combined report PDF, choose a destination —
// upload/share to OneDrive (iOS share sheet), append onto an existing PDF test
// log, or just save to Files.

interface Props {
  pdfBytes: Uint8Array;
  fileName: string;
  onClose: () => void;
}

function bytesToBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer so the Blob is backed by a plain ArrayBuffer.
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: 'application/pdf' });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function shareBlob(blob: Blob, name: string): Promise<boolean> {
  const file = new File([blob], name, { type: 'application/pdf' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({
      files: [file],
      title: name,
      text: 'Test report',
    });
    return true;
  }
  return false;
}

export default function ExportDialog({ pdfBytes, fileName, onClose }: Props) {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const shareToOneDrive = async () => {
    setBusy(true);
    setStatus('');
    try {
      const blob = bytesToBlob(pdfBytes);
      const shared = await shareBlob(blob, fileName);
      if (!shared) {
        downloadBlob(blob, fileName);
        setStatus(
          'Your device does not support direct sharing here — the PDF was downloaded. Open it and use "Save to Files → OneDrive".',
        );
      } else {
        setStatus('Shared. Choose OneDrive (or Files → OneDrive) in the share sheet.');
      }
    } catch {
      setStatus('Sharing was cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const saveToFiles = () => {
    downloadBlob(bytesToBlob(pdfBytes), fileName);
    setStatus('Saved. In the download/Files prompt, pick your OneDrive folder.');
  };

  const appendToExisting = async (file: File) => {
    setBusy(true);
    setStatus('');
    try {
      const existing = await file.arrayBuffer();
      const merged = await appendReportToLog(existing, pdfBytes);
      const outName = file.name.replace(/\.pdf$/i, '') + ' (updated).pdf';
      const blob = bytesToBlob(merged);
      const shared = await shareBlob(blob, outName);
      if (!shared) downloadBlob(blob, outName);
      setStatus(
        `Appended this report to "${file.name}". Save the updated log back to the same OneDrive location.`,
      );
    } catch {
      setStatus('Could not read that PDF. Please pick a valid PDF test log.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Save / Send report</h2>
        <p className="hint">
          Combined PDF ready: <strong>{fileName}</strong>
        </p>

        <div className="card">
          <h3>Upload to OneDrive</h3>
          <p className="hint">
            Opens the share sheet — choose the OneDrive app (or Files → OneDrive) to
            store this report in your job folder.
          </p>
          <button className="btn primary" onClick={shareToOneDrive} disabled={busy}>
            Share to OneDrive
          </button>
        </div>

        <div className="card">
          <h3>Append to existing PDF test log</h3>
          <p className="hint">
            Pick your running test-log PDF (from Files/OneDrive). This report's pages
            are added to the end, producing an updated single-source-of-truth log.
          </p>
          <label className="btn navy">
            Choose test log PDF…
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void appendToExisting(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <div className="card">
          <h3>Save to device / Files</h3>
          <button className="btn" onClick={saveToFiles} disabled={busy}>
            Save PDF
          </button>
        </div>

        {status && (
          <p className="hint" style={{ color: '#1b2733' }}>
            {status}
          </p>
        )}

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
