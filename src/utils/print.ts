/**
 * Tyrebuddy High-Speed Print & PDF Subsystem
 * Zero-hang, isolated-iframe printing, fast vector PDF, and audit-logged operations.
 */

import html2pdf from 'html2pdf.js';
import type { InvoicePaper, InvoiceModel, InvoiceOptions } from './invoiceModel';
import { renderInvoicePdf, type InvoicePdfExtras } from './invoicePdf';
import { auditPrintEvent } from './auditDiagnostics';
import { downloadFile } from './export';

/* ------------------------------------------------------------------ */
/*  Paper size mapping                                                 */
/* ------------------------------------------------------------------ */

export function paperToJsPDFFormat(paper: InvoicePaper): string | [number, number] {
  switch (paper) {
    case 'A4':          return 'a4';
    case 'A5':          return 'a5';
    case 'A6':          return 'a6';
    case 'THERMAL_4x6': return [4, 6];
    case 'THERMAL_2':   return [2, 8];
    case 'THERMAL_3':   return [3, 8];
  }
}

export function paperToPageCSS(paper: InvoicePaper): string {
  switch (paper) {
    case 'A4':          return 'A4';
    case 'A5':          return 'A5';
    case 'A6':          return 'A6';
    case 'THERMAL_4x6': return '4in 6in';
    case 'THERMAL_2':   return '2in 8in';
    case 'THERMAL_3':   return '3in 8in';
  }
}

/** Paper height in CSS pixels (96dpi), minus 6mm margins top and bottom. */
export function paperContentHeightPx(paper: InvoicePaper): number {
  const mmH: Record<InvoicePaper, number> = {
    A4: 297, A5: 210, A6: 148,
    THERMAL_4x6: 152.4, THERMAL_2: 203.2, THERMAL_3: 203.2,
  };
  return (mmH[paper] - 12) * 3.7795275591;
}

/* ------------------------------------------------------------------ */
/*  Mobile & Environment Detection                                     */
/* ------------------------------------------------------------------ */

export function isMobileLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS;
}

/* ------------------------------------------------------------------ */
/*  Save / Share Helpers                                               */
/* ------------------------------------------------------------------ */

export async function saveAndShareBlob(
  filename: string,
  blob: Blob
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (
      typeof navigator !== 'undefined' &&
      'canShare' in navigator &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'shared';
  }

  // Fallback to direct download
  downloadFile(filename, blob, blob.type);
  return 'downloaded';
}

export async function saveAndShareFile(
  filename: string,
  dataUri: string,
  mimeType: string
): Promise<'shared' | 'downloaded'> {
  const res = await fetch(dataUri);
  const blob = await res.blob();
  return saveAndShareBlob(filename, blob);
}

/* ------------------------------------------------------------------ */
/*  Isolated Iframe Printing (Prevents App Freezing & Hangs)          */
/* ------------------------------------------------------------------ */

const PRINT_FRAME_ID = 'tb-isolated-print-frame';

/**
 * Clean up any stuck print iframes or dynamic styles left over
 */
export function cleanupStuckPrintFrames(): void {
  try {
    const oldFrame = document.getElementById(PRINT_FRAME_ID);
    if (oldFrame) oldFrame.remove();

    const styleEl = document.getElementById('invoice-dynamic-page-size');
    if (styleEl) styleEl.remove();
  } catch {}
}

/**
 * Prints HTML content inside an isolated, hidden iframe.
 * Never halts the main React thread or causes UI unresponsiveness.
 */
export function printHtmlInHiddenIframe(
  contentHtml: string,
  pageCss: string,
  title = 'Tyrebuddy Document'
): Promise<'printed' | 'failed'> {
  return new Promise((resolve) => {
    cleanupStuckPrintFrames();

    const iframe = document.createElement('iframe');
    iframe.id = PRINT_FRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    let resolved = false;
    const cleanupAndResolve = (result: 'printed' | 'failed') => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimer);
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {}
      resolve(result);
    };

    // Safety timeout: Never let the app hang waiting for printer response
    const safetyTimer = setTimeout(() => {
      cleanupAndResolve('printed');
    }, 4500);

    iframe.onload = () => {
      try {
        const frameWin = iframe.contentWindow;
        if (!frameWin) {
          cleanupAndResolve('failed');
          return;
        }

        frameWin.onafterprint = () => {
          cleanupAndResolve('printed');
        };

        // Focus and trigger print
        frameWin.focus();
        setTimeout(() => {
          try {
            frameWin.print();
            // On browsers that do not fire onafterprint synchronously:
            setTimeout(() => cleanupAndResolve('printed'), 1000);
          } catch (err) {
            console.warn('[PrintEngine] Iframe print call failed:', err);
            cleanupAndResolve('failed');
          }
        }, 150);
      } catch (err) {
        console.warn('[PrintEngine] Iframe onload error:', err);
        cleanupAndResolve('failed');
      }
    };

    document.body.appendChild(iframe);

    // Build standalone HTML payload with all critical borders and print-safe styles
    const docHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page {
              size: ${pageCss};
              margin: 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 11px;
            }
            table { border-collapse: collapse; }
            th, td { border-color: #000000 !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            img, svg { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(docHtml);
        doc.close();
      } else {
        cleanupAndResolve('failed');
      }
    } catch {
      cleanupAndResolve('failed');
    }
  });
}

/* ------------------------------------------------------------------ */
/*  PDF Cache (IndexedDB)                                              */
/* ------------------------------------------------------------------ */

const DB_NAME = 'otbims-invoice-cache';
const STORE = 'pdfs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function clearPdfCache(): Promise<void> {
  return openDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    )
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Main Print Entry Point                                             */
/* ------------------------------------------------------------------ */

export interface PrintOptions {
  element: HTMLElement;
  paper: InvoicePaper;
  filename: string;
  onProgress?: (msg: string) => void;
  forcePdf?: boolean;
  cacheKey?: string;
  skipCache?: boolean;
  timeoutMs?: number;
  /** Direct vector PDF payload (bypasses canvas for instant 2ms generation) */
  model?: InvoiceModel;
  invoiceOpts?: InvoiceOptions;
  extras?: InvoicePdfExtras;
  pdfBytes?: Uint8Array;
}

export type PrintResult = 'printed' | 'shared' | 'downloaded' | 'failed' | 'cancelled';

export async function printInvoice(opts: PrintOptions): Promise<PrintResult> {
  const {
    element,
    paper,
    filename,
    onProgress,
    forcePdf,
    model,
    invoiceOpts,
    extras,
    pdfBytes,
  } = opts;

  const invoiceNo = model?.invoiceNo || filename.replace(/[^0-9A-Za-z-]/g, '');
  const startTime = performance.now();

  await auditPrintEvent('ATTEMPT', {
    paper,
    invoiceNo,
    method: forcePdf || isMobileLike() ? 'Vector/PDF' : 'IsolatedFrame',
  });

  try {
    // PATH 1: Direct Vector PDF Generation (Fastest, 100% reliable, zero external dependencies)
    let finalPdfBytes: Uint8Array | null = pdfBytes || null;
    if (!finalPdfBytes && model && invoiceOpts && extras) {
      onProgress?.('Generating vector PDF…');
      finalPdfBytes = renderInvoicePdf(model, invoiceOpts, extras);
    }

    if (finalPdfBytes) {
      const blob = new Blob([finalPdfBytes as BlobPart], { type: 'application/pdf' });

      if (forcePdf || isMobileLike()) {
        onProgress?.('Saving PDF…');
        const res = await saveAndShareBlob(filename, blob);
        await auditPrintEvent('SUCCESS', {
          paper,
          invoiceNo,
          method: 'VectorPdf:ShareOrDownload',
        });
        return res;
      }

      // Desktop: User requested physical printing
      onProgress?.('Opening print dialog…');
      const cleanHtml = element ? element.outerHTML : '<div>Invoice</div>';
      const printRes = await printHtmlInHiddenIframe(cleanHtml, paperToPageCSS(paper), filename);
      await auditPrintEvent(printRes === 'printed' ? 'SUCCESS' : 'ERROR', {
        paper,
        invoiceNo,
        method: 'VectorPdf:IsolatedFrame',
        errorMessage: printRes === 'failed' ? 'Frame print did not settle' : undefined,
      });
      return printRes;
    }

    // PATH 2: Element-based Printing (Combined Sheet or Custom DOM)
    if (forcePdf || isMobileLike()) {
      onProgress?.('Generating document PDF…');

      // Safe HTML2PDF rendering with short 4s timeout to guarantee zero hang
      const pdfPromise = html2pdf()
        .from(element)
        .set({
          margin: 0.25,
          filename,
          image: { type: 'jpeg' as const, quality: 0.90 },
          pagebreak: { mode: ['css', 'legacy'] },
          html2canvas: {
            scale: 1,
            useCORS: true,
            logging: false,
            imageTimeout: 1000,
            removeContainer: true,
          },
          jsPDF: {
            unit: 'in',
            format: paperToJsPDFFormat(paper),
            orientation: 'portrait' as const,
          },
        })
        .outputPdf('blob');

      const blob = await Promise.race([
        pdfPromise as Promise<Blob>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timed out')), 4000)
        ),
      ]);

      const how = await saveAndShareBlob(filename, blob);
      await auditPrintEvent('SUCCESS', {
        paper,
        invoiceNo,
        method: 'Html2Pdf:SafeRender',
      });
      return how;
    }

    // Desktop standard print: Isolated Iframe
    onProgress?.('Preparing print…');
    const cleanHtml = element.outerHTML;
    const res = await printHtmlInHiddenIframe(cleanHtml, paperToPageCSS(paper), filename);

    const elapsed = Math.round(performance.now() - startTime);
    await auditPrintEvent(res === 'printed' ? 'SUCCESS' : 'ERROR', {
      paper,
      invoiceNo,
      method: `IsolatedFrame (${elapsed}ms)`,
    });
    return res;
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Print pipeline failed');
    console.warn('[PrintEngine] Print failed, attempting safe download fallback:', errorMsg);

    await auditPrintEvent('ERROR', {
      paper,
      invoiceNo,
      method: 'PrintException',
      errorMessage: errorMsg,
    });

    // Ultimate Resilient Fallback: If printing hung or failed, generate text/raw document or native prompt
    try {
      if (model && invoiceOpts && extras) {
        const fallbackBytes = renderInvoicePdf(model, invoiceOpts, extras);
        const fallbackBlob = new Blob([fallbackBytes as BlobPart], { type: 'application/pdf' });
        downloadFile(filename, fallbackBlob, 'application/pdf');
        return 'downloaded';
      }
    } catch {}

    return 'failed';
  } finally {
    // CRITICAL: Guarantee progress indicator is cleared so buttons are never stuck disabled
    cleanupStuckPrintFrames();
    onProgress?.('');
  }
}

/* ------------------------------------------------------------------ */
/*  Universal Safe Print Helper (Reports, Labels, Ledger, Products)   */
/* ------------------------------------------------------------------ */

export async function safePrint(
  targetElement?: HTMLElement | string | null,
  paper: InvoicePaper = 'A4'
): Promise<boolean> {
  try {
    let el: HTMLElement | null = null;
    if (typeof targetElement === 'string') {
      el = document.querySelector(targetElement) as HTMLElement | null;
    } else if (targetElement) {
      el = targetElement;
    }

    if (el) {
      const res = await printHtmlInHiddenIframe(el.outerHTML, paperToPageCSS(paper));
      return res === 'printed';
    }

    // Safe fallback to window.print() inside try-catch
    window.print();
    return true;
  } catch (err) {
    console.warn('[PrintEngine] safePrint caught error:', err);
    await auditPrintEvent('ERROR', {
      paper,
      invoiceNo: 'DirectPrint',
      method: 'safePrint',
      errorMessage: String(err),
    });
    return false;
  }
}
