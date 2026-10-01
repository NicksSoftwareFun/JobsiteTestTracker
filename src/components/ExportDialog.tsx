import { useEffect, useState } from 'react';
import { appendReportToLog } from '../pdf/appendToLog';
import { downloadBlob, saveFileWithPicker, type SaveResult } from '../utils';

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
  // Message for the blocking "working" overlay (null = idle). While set, the
  // dialog can't be dismissed, so a save/share can't be interrupted.
  const [working, setWorking] = useState<string | null>(null);
  const blocked = busy || working !== null;

  // Warn before closing/reloading the tab mid-save.
  useEffect(() => {
    if (!working) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [working]);
  // Touch devices (iPad/iPhone) → Share/OneDrive; computers → Save to File.
  const isTouch =
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
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
    setWorking('Waiting for the share sheet to finish…');
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
    } finally {
      setWorking(null);
    }
  };

  const shareReport = () =>
    shareOrDownload(pdfBytes, fileName, 'Shared. Choose OneDrive (or Files → OneDrive) in the share sheet.');

  // Save via the folder picker (computers) and report exactly what happened.
  const saveWithPicker = async (bytes: Uint8Array, name: string): Promise<SaveResult | 'error'> => {
    setStatus('');
    setWorking('Choose where to save the PDF…');
    try {
      const res = await saveFileWithPicker(bytesToBlob(bytes), name, () =>
        setWorking(`Saving "${name}"… please wait.`),
      );
      if (res === 'saved') setStatus(`Saved "${name}" to the folder you chose.`);
      else if (res === 'downloaded')
        setStatus('Saved. In the download/Files prompt, pick your folder (e.g. OneDrive).');
      else if (res === 'fallback')
        setStatus(
          `Couldn't write to the folder you picked (it may be syncing to OneDrive or open in another app), so "${name}" was saved to your Downloads folder instead. Move it from there.`,
        );
      return res;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      return 'error';
    } finally {
      setWorking(null);
    }
  };

  const saveToFiles = () => void saveWithPicker(pdfBytes, fileName);

  // Step 1 of append: read + merge (async). Does NOT share (gesture would be gone).
  const mergeWithLog = async (file: File) => {
    setBusy(true);
    setWorking('Adding this report to the test log…');
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
      // Combined logs are named so they're easy to find in OneDrive/Files.
      const base = file.name.replace(/\.pdf$/i, '');
      const outName = `Combined Test Log - ${base}.pdf`;
      setMergedLog({ bytes: merged, name: outName });
      // A dedicated popup (below) handles saving the combined file.
      setStatus('');
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
      setWorking(null);
    }
  };

  // After combining, saving/sharing the combined log closes BOTH popups.
  const shareCombined = async () => {
    if (!mergedLog) return;
    await shareOrDownload(
      mergedLog.bytes,
      mergedLog.name,
      `Shared "${mergedLog.name}".`,
    );
    onClose();
  };
  const saveCombined = async () => {
    if (!mergedLog) return;
    const res = await saveWithPicker(mergedLog.bytes, mergedLog.name);
    if (res === 'saved' || res === 'downloaded') onClose();
    else if (res !== 'cancelled') setMergedLog(null); // keep the main dialog open to show the message
  };

  return (
    <>
      <div className="modal-backdrop" onClick={() => !blocked && onClose()}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Save / Send report</h2>
          <p className="hint">
            Combined PDF ready: <strong>{fileName}</strong>
          </p>

          {/* Save THIS report: one split row of two equal actions */}
          <div className="card">
            <h3>Save this report</h3>
            <p className="hint">
              On <strong>iPad / iPhone</strong>, use <strong>Share / OneDrive</strong>. On a{' '}
              <strong>computer</strong>, use <strong>Save to File</strong>.
            </p>
            <div className="btn-split">
              <button className="btn primary block" onClick={shareReport} disabled={blocked}>
                📱 Share / OneDrive
                <span className="btn-cap">iPad / iPhone{isTouch ? ' — recommended' : ''}</span>
              </button>
              <button className="btn navy block" onClick={saveToFiles} disabled={blocked}>
                💻 Save to File
                <span className="btn-cap">Computer{!isTouch ? ' — recommended' : ''}</span>
              </button>
            </div>
          </div>

          {/* Append to an existing running log */}
          <div className="card">
            <h3>Append to existing PDF test log</h3>
            <p className="hint">
              Pick your running test-log PDF (from Files/OneDrive). This report's pages
              are added to the end, producing an updated single-source-of-truth log.
            </p>
            <label className={`btn navy block${blocked ? ' disabled' : ''}`}>
              {busy ? 'Working…' : 'Choose test log PDF…'}
              <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                disabled={blocked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void mergeWithLog(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {status && <p className="status-note">{status}</p>}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn" onClick={onClose} disabled={blocked}>
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Combined-log popup: appears once the append is done */}
      {mergedLog && (
        <div className="modal-backdrop" onClick={() => !blocked && setMergedLog(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Save combined test log</h2>
            <p className="hint">
              Your report was added to the log. Save the combined file —{' '}
              <strong>{mergedLog.name}</strong>:
            </p>
            <div className="btn-split">
              <button className="btn primary block" onClick={shareCombined} disabled={blocked}>
                📱 Share / OneDrive
                <span className="btn-cap">iPad / iPhone{isTouch ? ' — recommended' : ''}</span>
              </button>
              <button className="btn navy block" onClick={saveCombined} disabled={blocked}>
                💻 Save to File
                <span className="btn-cap">Computer{!isTouch ? ' — recommended' : ''}</span>
              </button>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn danger sm" onClick={() => setMergedLog(null)} disabled={blocked}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {working && (
        <div className="working-overlay" role="alertdialog" aria-busy="true" aria-live="assertive">
          <div className="working-box">
            <div className="spinner" aria-hidden="true" />
            <div className="working-msg">{working}</div>
            <div className="hint">Please don't close this window until it finishes.</div>
          </div>
        </div>
      )}
    </>
  );
}
