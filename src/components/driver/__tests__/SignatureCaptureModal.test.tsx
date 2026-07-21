import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignatureCaptureModal from "../SignatureCaptureModal";

const mockClear = jest.fn();
const mockIsEmpty = jest.fn();
const mockGetTrimmedCanvas = jest.fn();
const mockToDataURL = jest.fn();

jest.mock("react-signature-canvas", () => {
  const React = require("react");
  return React.forwardRef(function MockSignatureCanvas(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({
      clear: mockClear,
      isEmpty: mockIsEmpty,
      getTrimmedCanvas: mockGetTrimmedCanvas,
      toDataURL: mockToDataURL,
    }));
    return <canvas data-testid="signature-canvas" {...props.canvasProps} />;
  });
});

describe("SignatureCaptureModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEmpty.mockReturnValue(true);
    mockGetTrimmedCanvas.mockReturnValue({ toDataURL: mockToDataURL });
    mockToDataURL.mockReturnValue("data:image/png;base64,SIGNATURE_DATA");
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SignatureCaptureModal
        isOpen={false}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title with the passed documentTitle", () => {
    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />
    );
    expect(screen.getByText(/Sign: Safety Policy/)).toBeInTheDocument();
  });

  it("shows a validation error and does not call onSubmit when submitting with an empty canvas", async () => {
    mockIsEmpty.mockReturnValue(true);
    const onSubmit = jest.fn();

    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit Signature" }));

    expect(
      await screen.findByText("Please provide a signature before submitting")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clicking Clear resets the canvas", () => {
    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText("Clear"));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("clicking Submit Signature with a non-empty canvas calls onSubmit with a data URL string", async () => {
    mockIsEmpty.mockReturnValue(false);
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit Signature" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("data:image/png;base64,SIGNATURE_DATA");
  });

  it("clicking Cancel calls onCancel", () => {
    const onCancel = jest.fn();
    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={onCancel}
        onSubmit={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables buttons and shows a loading indicator while submitting is true", () => {
    render(
      <SignatureCaptureModal
        isOpen={true}
        documentTitle="Safety Policy"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
        submitting={true}
      />
    );

    expect(screen.getByText("Clear")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByText(/Signing.../)).toBeInTheDocument();
    // The submit button (now showing the loading label) should be disabled too.
    const submitButton = screen.getByText(/Signing.../).closest("button");
    expect(submitButton).toBeDisabled();
  });
});
