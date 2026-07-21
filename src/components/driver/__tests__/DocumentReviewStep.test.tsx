import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentReviewStep from "../DocumentReviewStep";

// Mock the signature modal itself to simplify DocumentReviewStep integration
// tests - we only need to verify it receives the right props/isOpen state
// and that its onSubmit callback wires up to the sign POST correctly.
let capturedModalProps: any = null;
jest.mock("../SignatureCaptureModal", () => {
  return function MockSignatureCaptureModal(props: any) {
    capturedModalProps = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="signature-modal">
        <span>Sign: {props.documentTitle}</span>
        <button
          type="button"
          onClick={() => props.onSubmit("data:image/png;base64,FAKESIG")}
        >
          Mock Submit Signature
        </button>
        <button type="button" onClick={props.onCancel}>
          Mock Cancel
        </button>
        {props.submitting && <span>Mock Signing...</span>}
      </div>
    );
  };
});

function jsonResponse(body: any, ok = true) {
  return { ok, json: async () => body };
}

const TOKEN = "fake-token";
const ROUTE_ID = "route-1";

function makeDoc(overrides: Partial<any> = {}) {
  return {
    id: "doc-1",
    title: "Safety Policy",
    description: "Read carefully",
    category: "SAFETY",
    documentType: "POLICY",
    filePath: "/uploads/system-documents/policy.pdf",
    fileName: "policy.pdf",
    fileSize: 2048,
    requiresSignature: false,
    ...overrides,
  };
}

describe("DocumentReviewStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedModalProps = null;
    global.fetch = jest.fn();
  });

  it("auto-calls onComplete() when the documents list is empty", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ documents: [] }));
    const onComplete = jest.fn();

    render(<DocumentReviewStep onComplete={onComplete} token={TOKEN} routeId={ROUTE_ID} />);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('renders the existing "✓ I Have Read This" button (not the sign button) for requiresSignature: false', async () => {
    const doc = makeDoc({ requiresSignature: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ documents: [doc] }));

    render(<DocumentReviewStep onComplete={jest.fn()} token={TOKEN} routeId={ROUTE_ID} />);

    expect(await screen.findByText("✓ I Have Read This")).toBeInTheDocument();
    expect(screen.queryByText("✍️ Sign to Continue")).not.toBeInTheDocument();
  });

  it('renders "✍️ Sign to Continue" for requiresSignature: true, and clicking it opens the SignatureCaptureModal', async () => {
    const doc = makeDoc({ requiresSignature: true });
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ documents: [doc] }));

    render(<DocumentReviewStep onComplete={jest.fn()} token={TOKEN} routeId={ROUTE_ID} />);

    const signButton = await screen.findByText("✍️ Sign to Continue");
    expect(screen.queryByText("✓ I Have Read This")).not.toBeInTheDocument();

    // Modal rendered but closed initially.
    expect(capturedModalProps.isOpen).toBe(false);

    fireEvent.click(signButton);

    await waitFor(() => expect(capturedModalProps.isOpen).toBe(true));
    expect(capturedModalProps.documentTitle).toBe("Safety Policy");
    expect(screen.getByTestId("signature-modal")).toBeInTheDocument();
  });

  it("submitting a signature triggers a POST to /api/driver/system-documents/sign with the correct body shape, and on success removes the document from the pending list", async () => {
    const doc = makeDoc({ id: "doc-sign-1", requiresSignature: true });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ documents: [doc] })) // initial GET
      .mockResolvedValueOnce(jsonResponse({ message: "Document signed successfully" })); // sign POST

    render(<DocumentReviewStep onComplete={jest.fn()} token={TOKEN} routeId={ROUTE_ID} />);

    fireEvent.click(await screen.findByText("✍️ Sign to Continue"));
    await waitFor(() => expect(capturedModalProps.isOpen).toBe(true));

    fireEvent.click(screen.getByText("Mock Submit Signature"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const signCallArgs = (global.fetch as jest.Mock).mock.calls[1];
    expect(signCallArgs[0]).toBe("/api/driver/system-documents/sign");
    expect(signCallArgs[1].method).toBe("POST");
    expect(signCallArgs[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const sentBody = JSON.parse(signCallArgs[1].body);
    expect(sentBody).toEqual({
      documentId: "doc-sign-1",
      signatureImageBase64: "data:image/png;base64,FAKESIG",
      routeId: ROUTE_ID,
    });

    // Document removed from the pending list.
    await waitFor(() =>
      expect(screen.queryByText("✍️ Sign to Continue")).not.toBeInTheDocument()
    );
  });

  it("shows an error and keeps the document in the list if the sign POST fails", async () => {
    const doc = makeDoc({ id: "doc-sign-2", requiresSignature: true });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ documents: [doc] })) // initial GET
      .mockResolvedValueOnce(jsonResponse({ message: "Signature invalid" }, false)); // sign POST fails

    render(<DocumentReviewStep onComplete={jest.fn()} token={TOKEN} routeId={ROUTE_ID} />);

    fireEvent.click(await screen.findByText("✍️ Sign to Continue"));
    await waitFor(() => expect(capturedModalProps.isOpen).toBe(true));

    fireEvent.click(screen.getByText("Mock Submit Signature"));

    expect(await screen.findByText("Signature invalid")).toBeInTheDocument();
    // Document remains in the pending list (not incorrectly removed).
    expect(screen.getByText("✍️ Sign to Continue")).toBeInTheDocument();
  });
});
