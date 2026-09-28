/** Send generated PDF bytes to the device's built-in print function.
 *
 *  Desktop / Android: load the PDF into a hidden iframe and call print(), which
 *  opens the browser's native print dialog directly.
 *
 *  iPad / iPhone Safari cannot print a blob from a hidden iframe, so we open the
 *  PDF in the built-in viewer where the user taps Share → Print (AirPrint). */
export function printPdfBytes(bytes: Uint8Array): void {
  // Copy into a fresh ArrayBuffer so the Blob is backed by a plain ArrayBuffer.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // iPadOS 13+ reports as "MacIntel" with touch points, so check that too.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // Native PDF viewer opens; its Share sheet offers Print / AirPrint.
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank'); // fall back to the viewer's own print
    }
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
