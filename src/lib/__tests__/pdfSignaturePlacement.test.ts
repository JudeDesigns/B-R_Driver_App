import { findSignaturePlacement } from "../pdfSignaturePlacement";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function makePdfDocument(items: any[], opts: { numPages?: number } = {}) {
  const { numPages = 1 } = opts;
  return {
    numPages,
    getPage: jest.fn().mockResolvedValue({
      getViewport: () => ({ width: PAGE_WIDTH, height: PAGE_HEIGHT }),
      getTextContent: jest.fn().mockResolvedValue({ items }),
    }),
  };
}

const mockGetDocument = jest.fn();

jest.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: (...args: any[]) => mockGetDocument(...args),
}));

const mockPdfLibLoad = jest.fn();

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: (...args: any[]) => mockPdfLibLoad(...args),
  },
}));

describe("findSignaturePlacement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a valid { pageIndex, x, y } result for a simple PDF with sparse/no text", async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfDocument([])),
    });

    const result = await findSignaturePlacement(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      pageIndex: 0,
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
    // Should be placed in the bottom band of the page (well below vertical center).
    expect(result.y).toBeLessThan(PAGE_HEIGHT / 2);
  });

  it("falls back to the safe bottom-right default when text extraction throws/fails", async () => {
    mockGetDocument.mockImplementation(() => {
      throw new Error("Malformed PDF");
    });

    mockPdfLibLoad.mockResolvedValue({
      getPages: () => [{ getWidth: () => PAGE_WIDTH }],
    });

    const result = await findSignaturePlacement(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      pageIndex: 0,
      x: Math.max(0, PAGE_WIDTH - 200),
      y: 40,
    });
  });

  it("falls back to the safe bottom-right default when the page is extremely text-dense", async () => {
    // A single giant text item covering the entire page - every candidate
    // window will overlap heavily, so no "sufficiently clear" region exists.
    const denseItems = [
      {
        transform: [1, 0, 0, 1, 0, 0],
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      },
    ];
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfDocument(denseItems)),
    });

    const result = await findSignaturePlacement(new Uint8Array([1, 2, 3]));

    expect(result).toEqual({
      pageIndex: 0,
      x: Math.max(0, PAGE_WIDTH - 200),
      y: 40,
    });
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it("returns coordinates within valid page bounds and consistent with bottom placement for a multi-page document", async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(makePdfDocument([], { numPages: 3 })),
    });

    const result = await findSignaturePlacement(new Uint8Array([1, 2, 3]));

    // Targets the LAST page (0-based index numPages - 1).
    expect(result.pageIndex).toBe(2);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x).toBeLessThanOrEqual(PAGE_WIDTH);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThan(PAGE_HEIGHT * 0.35);
  });
});
