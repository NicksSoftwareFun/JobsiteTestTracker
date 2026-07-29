import { useState } from 'react';
import { appendReportToLog } from '../pdf/appendToLog';

// User story 3: after generating the combined report PDF, choose a destination —
// upload/share to OneDrive (iOS share sheet), append onto an existing PDF test
// log, or just save to Files.
//
// NOTE: navigator.share() must be invoked from a live user gesture. Any async
// work (reading/merging a PDF) before the call consumes that gesture and iOS
// throws "Must be handling a user gesture". So the append flow is two steps:
// pick+merge (async) first, then the user taps a Share/Save button (fresh
// gesture) to send the result.

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

function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  return nav.canShare({ files: [file] });
}

export default function ExportDialog({ pdfBytes, fileName, onClose }: Props) {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  // Result of merging this report into a chosen log, awaiting a Share/Save tap.
  const [mergedLog, setMergedLog] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  // Called directly from a button tap so the Web Share user-gesture rule holds.
  const shareOrDownload = async (bytes: Uint8Array, name: string, successMsg: string) => {
    const blob = bytesToBlob(bytes);
    const file = new File([blob], name, { type: 'application/pdf' });
    if (!canShareFiles(file)) {
      downloadBlob(blob, name);
      setStatus('Sharing isn\'t available here — the PDF was downloaded. Open it and use "Save to Files → OneDrive".');
      return;
    }
    try {
      await (navigator as Navigator).share({ files: [file], title: name });
      setStatus(successMsg);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus('Share cancelled — nothing sent.');
        return;
      }
      // e.g. gesture expired or share unavailable → fall back to a download.
      downloadBlob(blob, name);
      setStatus('Couldn\'t open the share sheet, so the PDF was downloaded — open it and use "Save to Files → OneDrive".');
    }
  };

  const shareReport = () =>
    shareOrDownload(pdfBytes, fileName, 'Shared. Choose OneDrive (or Files → OneDrive) in the share sheet.');

  const saveToFiles = () => {
    downloadBlob(bytesToBlob(pdfBytes), fileName);
    setStatus('Saved. In the download/Files prompt, pick your OneDrive folder.');
  };

  // Step 1 of append: read + merge (async). Does NOT share (gesture would be gone).
  const mergeWithLog = async (file: File) => {
    setBusy(true);
    setStatus('');
    setMergedLog(null);
    try {
      const existing = await file.arrayBuffer();
      if (!existing || existing.byteLength === 0) {
        setStatus(
          `"${file.name}" came through empty. If it lives in OneDrive/iCloud, open it once in the Files app so it downloads, then try again.`,
        );
        return;
      }
      const header = new TextDecoder().decode(new Uint8Array(existing.slice(0, 5)));
      if (!header.startsWith('%PDF')) {
        setStatus(`"${file.name}" doesn't look like a PDF. Please pick a PDF test log.`);
        return;
      }
      const merged = await appendReportToLog(existing, pdfBytes);
      const outName = file.name.replace(/\.pdf$/i, '') + ' (updated).pdf';
      setMergedLog({ bytes: merged, name: outName });
      setStatus(`Added this report to "${file.name}". Now tap Share or Save below to store the updated log.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const passwordProtected = /password|encrypt/i.test(msg);
      setStatus(
        passwordProtected
          ? `"${file.name}" is password-protected. Remove the password (open it and re-save without protection), then try again.`
          : `Couldn't append to "${file.name}": ${msg}`,
      );
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
          <button className="btn primary" onClick={shareReport} disabled={busy}>
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
            {mergedLog ? 'Choose a different test log…' : 'Choose test log PDF…'}
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void mergeWithLog(f);
                e.currentTarget.value = '';
              }}
            />
          </label>

          {mergedLog && (
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  shareOrDownload(
                    mergedLog.bytes,
                    mergedLog.name,
                    `Shared "${mergedLog.name}". Save it back to the same OneDrive location.`,
                  )
                }
              >
                Share updated log
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  downloadBlob(bytesToBlob(mergedLog.bytes), mergedLog.name);
                  setStatus(`Saved "${mergedLog.name}". Put it back in the same OneDrive location.`);
                }}
              >
                Save updated log
              </button>
            </div>
          )}
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
