/**
 * Whitespace-aware signature placement helper.
 *
 * Given the bytes of a PDF, finds a reasonable, mostly-empty location near the
 * bottom of the last page to stamp a fixed-size (180x60 pt) signature image.
 *
 * Implementation notes:
 * - Uses pdfjs-dist's legacy Node build (`pdfjs-dist/legacy/build/pdf.mjs`) to
 *   extract text content only (via `page.getTextContent()`), which does NOT
 *   require the optional `canvas` package (that's only needed for rendering
 *   pages to images/canvases, which we never do here).
 * - Pure function: accepts PDF bytes, returns coordinates. No side effects,
 *   so it can be unit tested independently of any running server.
 * - All coordinates are in PDF points using pdf-lib's bottom-left origin
 *   coordinate system (pdfjs-dist's `getTextContent()` transform matrices are
 *   already expressed in that same PDF user-space coordinate system).
 */

// Fixed signature stamp size (must match the size used when actually drawing
// the signature image onto the page).
const SIG_WIDTH = 180;
const SIG_HEIGHT = 60;

// Minimum clear window we look for around the signature (small margin around
// the fixed signature size).
const WINDOW_WIDTH = 190;
const WINDOW_HEIGHT = 70;

// Fraction of the page height (from the bottom) that we consider for
// signature placement.
const BOTTOM_BAND_FRACTION = 0.35;

// Grid dimensions within the bottom band.
const GRID_ROWS = 4;
const GRID_COLS = 3;

// Overlap ratio (of window area) below which we consider a candidate window
// "sufficiently clear" of text.
const CLEAR_OVERLAP_THRESHOLD = 0.03;

interface OccupiedBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface SignaturePlacement {
  pageIndex: number;
  x: number;
  y: number;
}

function rectOverlapArea(
  ax0: number,
  ay0: number,
  ax1: number,
  ay1: number,
  bx0: number,
  by0: number,
  bx1: number,
  by1: number
): number {
  const overlapX = Math.min(ax1, bx1) - Math.max(ax0, bx0);
  const overlapY = Math.min(ay1, by1) - Math.max(ay0, by0);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return overlapX * overlapY;
}

function safeDefaultPlacement(pageIndex: number, pageWidth: number): SignaturePlacement {
  return {
    pageIndex,
    x: Math.max(0, pageWidth - 200),
    y: 40,
  };
}

/**
 * Find a whitespace-aware location for a signature stamp on the last page of
 * a PDF document.
 */
export async function findSignaturePlacement(
  pdfBytes: Uint8Array | Buffer
): Promise<SignaturePlacement> {
  try {
    // Dynamically import the legacy Node build of pdfjs-dist. This avoids
    // requiring the optional `canvas` native dependency, since we only use
    // text-content extraction (no rendering).
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const data =
      pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pageIndex = pdfDocument.numPages - 1; // last page, 0-based
    const page = await pdfDocument.getPage(pageIndex + 1); // pdfjs pages are 1-based

    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const textContent = await page.getTextContent();

    const occupiedBoxes: OccupiedBox[] = [];
    for (const item of textContent.items as any[]) {
      if (!item || !item.transform) continue;
      const x0 = item.transform[4];
      const y0 = item.transform[5];
      const width = typeof item.width === "number" ? item.width : 0;
      const height = typeof item.height === "number" && item.height > 0 ? item.height : 10;

      occupiedBoxes.push({
        x0: x0 - 1,
        x1: x0 + width + 1,
        y0: y0 - 1,
        y1: y0 + height + 1,
      });
    }

    const bandBottom = 0;
    const bandHeight = pageHeight * BOTTOM_BAND_FRACTION;
    const rowHeight = bandHeight / GRID_ROWS;
    const colWidth = pageWidth / GRID_COLS;

    // Column preference: right (2), left (0), center (1) - mimics a typical
    // "signature line" location toward the bottom-right of a document.
    const colPreference = [2, 0, 1];

    for (let row = 0; row < GRID_ROWS; row++) {
      const rowBottom = bandBottom + row * rowHeight;
      const rowTop = rowBottom + rowHeight;
      const rowCenterY = (rowBottom + rowTop) / 2;

      for (const col of colPreference) {
        const cellLeft = col * colWidth;
        const cellRight = cellLeft + colWidth;
        const cellCenterX = (cellLeft + cellRight) / 2;

        // Anchor a fixed WINDOW_WIDTH x WINDOW_HEIGHT window centered within
        // this grid cell, clamped so it stays on the page.
        let windowX = cellCenterX - WINDOW_WIDTH / 2;
        let windowY = rowCenterY - WINDOW_HEIGHT / 2;

        windowX = Math.min(Math.max(windowX, 0), Math.max(pageWidth - WINDOW_WIDTH, 0));
        windowY = Math.min(Math.max(windowY, 0), Math.max(pageHeight - WINDOW_HEIGHT, 0));

        const windowX1 = windowX + WINDOW_WIDTH;
        const windowY1 = windowY + WINDOW_HEIGHT;

        let overlapArea = 0;
        for (const box of occupiedBoxes) {
          overlapArea += rectOverlapArea(
            windowX,
            windowY,
            windowX1,
            windowY1,
            box.x0,
            box.y0,
            box.x1,
            box.y1
          );
        }

        const overlapRatio = overlapArea / (WINDOW_WIDTH * WINDOW_HEIGHT);

        if (overlapRatio < CLEAR_OVERLAP_THRESHOLD) {
          // Center the fixed-size signature within the clear window.
          const x = windowX + (WINDOW_WIDTH - SIG_WIDTH) / 2;
          const y = windowY + (WINDOW_HEIGHT - SIG_HEIGHT) / 2;
          return { pageIndex, x, y };
        }
      }
    }

    // No sufficiently clear region found - fall back to a safe default.
    return safeDefaultPlacement(pageIndex, pageWidth);
  } catch (error) {
    // Text extraction failed (malformed PDF, unsupported features, etc.) -
    // fall back to a safe bottom-right default on the last page. Attempt to
    // determine the real page count/width via pdf-lib (a separate, more
    // lenient PDF parser) so the fallback still targets the correct page;
    // if that also fails, assume a single standard-letter-sized page.
    console.error("findSignaturePlacement: falling back to default placement", error);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
      const doc = await PDFDocument.load(data, { ignoreEncryption: true });
      const pages = doc.getPages();
      const lastPageIndex = Math.max(pages.length - 1, 0);
      const lastPage = pages[lastPageIndex];
      const pageWidth = lastPage ? lastPage.getWidth() : 612;
      return safeDefaultPlacement(lastPageIndex, pageWidth);
    } catch (fallbackError) {
      console.error("findSignaturePlacement: pdf-lib fallback also failed", fallbackError);
      return safeDefaultPlacement(0, 612);
    }
  }
}
