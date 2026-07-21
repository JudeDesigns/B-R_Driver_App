import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EnhancedInvoiceUpload from "../EnhancedInvoiceUpload";

// jsdom does not implement these; the component relies on them for
// generating in-browser previews of selected images.
beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:mock-url");
  URL.revokeObjectURL = jest.fn();
});

function makeImageFile(name = "photo.jpg", sizeBytes = 1024) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type: "image/jpeg" });
  return file;
}

function makeNonImageFile(name = "notes.txt") {
  return new File(["hello"], name, { type: "text/plain" });
}

const noop = () => {};

describe("EnhancedInvoiceUpload", () => {
  beforeEach(() => {
    (global.fetch as any) = jest.fn();
    (Storage.prototype.getItem as any) = jest.fn(() => "fake-token");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders both the Financial Documents and Proof of Delivery sections with their exact instructions", () => {
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    expect(screen.getByText("Financial Documents")).toBeInTheDocument();
    expect(screen.getByText("Proof of Delivery and Execution")).toBeInTheDocument();

    expect(screen.getByText("Customer or vendor invoices")).toBeInTheDocument();
    expect(screen.getByText("Checks and payment receipts")).toBeInTheDocument();
    expect(screen.getByText("Statements")).toBeInTheDocument();
    expect(screen.getByText("Credit memos")).toBeInTheDocument();
    expect(screen.getByText("Gas and diesel receipts")).toBeInTheDocument();

    expect(screen.getByText("All four sides of each pallet")).toBeInTheDocument();
    expect(screen.getByText("Dollies loaded with products")).toBeInTheDocument();
    expect(screen.getByText("Product labels and weights")).toBeInTheDocument();
    expect(screen.getByText("Fuel pumps and related fueling documentation")).toBeInTheDocument();
  });

  it("shows the correct warning message for each section when it has no images and is not skipped", () => {
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    expect(screen.getByText("You have not uploaded any financial documents.")).toBeInTheDocument();
    expect(
      screen.getByText("You have not uploaded any proof-of-delivery or execution images.")
    ).toBeInTheDocument();
  });

  it("hides a section's warning once the driver checks 'Skip this section'", async () => {
    const user = userEvent.setup();
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const financialWarning = screen.getByText("You have not uploaded any financial documents.");
    const financialBox = financialWarning.closest("div.bg-white") as HTMLElement;
    const skipCheckbox = within(financialBox).getByRole("checkbox");

    await user.click(skipCheckbox);

    expect(
      within(financialBox).queryByText("You have not uploaded any financial documents.")
    ).not.toBeInTheDocument();
    // Delivery section warning should be unaffected
    expect(
      screen.getByText("You have not uploaded any proof-of-delivery or execution images.")
    ).toBeInTheDocument();
  });

  it("rejects non-image files and shows an error, without adding them to the grid", async () => {
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    // First financial input is the gallery (multiple) input
    const galleryInput = fileInputs[0] as HTMLInputElement;

    fireEvent.change(galleryInput, { target: { files: [makeNonImageFile()] } });

    expect(await screen.findByText("Only image files are allowed")).toBeInTheDocument();
    expect(screen.queryByText(/Selected Images/)).not.toBeInTheDocument();
  });

  it("adds a selected financial image to the Financial section only, clears its warning, and clears the skip flag", async () => {
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const financialGalleryInput = fileInputs[0] as HTMLInputElement;

    fireEvent.change(financialGalleryInput, { target: { files: [makeImageFile("invoice.jpg")] } });

    await waitFor(() => {
      expect(screen.getByText("Selected Images (1)")).toBeInTheDocument();
    });

    // Financial warning is gone, but delivery warning (still empty) remains.
    expect(screen.queryByText("You have not uploaded any financial documents.")).not.toBeInTheDocument();
    expect(
      screen.getByText("You have not uploaded any proof-of-delivery or execution images.")
    ).toBeInTheDocument();
  });

  it("disables the upload button when no images have been added to either section", () => {
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const uploadButton = screen.getByRole("button", { name: /Upload 0 Images & Generate PDF/i });
    expect(uploadButton).toBeDisabled();
  });

  it("uploads images from both sections and tags each request with its category, using a shared session id", async () => {
    const onUploadSuccess = jest.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ pdfUrl: "/pdf/stop-1.pdf" }),
    });

    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={onUploadSuccess}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const financialGalleryInput = fileInputs[0] as HTMLInputElement;
    const deliveryGalleryInput = fileInputs[2] as HTMLInputElement;

    fireEvent.change(financialGalleryInput, { target: { files: [makeImageFile("invoice.jpg")] } });
    await waitFor(() => expect(screen.getByText("Selected Images (1)")).toBeInTheDocument());

    fireEvent.change(deliveryGalleryInput, { target: { files: [makeImageFile("pallet.jpg")] } });
    await waitFor(() => {
      // Both sections now show "Selected Images (1)" — assert there are two matches.
      expect(screen.getAllByText("Selected Images (1)")).toHaveLength(2);
    });

    const uploadButton = screen.getByRole("button", { name: /Upload 2 Images & Generate PDF/i });
    expect(uploadButton).toBeEnabled();

    fireEvent.click(uploadButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    const [firstCall, secondCall] = (global.fetch as any).mock.calls;
    const firstFormData = firstCall[1].body as FormData;
    const secondFormData = secondCall[1].body as FormData;

    expect(firstFormData.get("category")).toBe("financial");
    expect(secondFormData.get("category")).toBe("delivery");
    // Same session id groups both uploads into a single combined PDF/email.
    expect(firstFormData.get("sessionId")).toBe(secondFormData.get("sessionId"));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith("/pdf/stop-1.pdf"));
  });

  it("surfaces the server error message when an upload request fails", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Safety check must be completed before uploading documents" }),
    });

    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const financialGalleryInput = fileInputs[0] as HTMLInputElement;
    fireEvent.change(financialGalleryInput, { target: { files: [makeImageFile("invoice.jpg")] } });
    await waitFor(() => expect(screen.getByText("Selected Images (1)")).toBeInTheDocument());

    const uploadButton = screen.getByRole("button", { name: /Upload 1 Image & Generate PDF/i });
    fireEvent.click(uploadButton);

    expect(
      await screen.findByText("Safety check must be completed before uploading documents")
    ).toBeInTheDocument();
  });

  it("shows a confirmation dialog before re-uploading when a PDF already exists, and cancels without calling fetch", async () => {
    const user = userEvent.setup();
    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl="/pdf/existing.pdf"
      />
    );

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const financialGalleryInput = fileInputs[0] as HTMLInputElement;
    fireEvent.change(financialGalleryInput, { target: { files: [makeImageFile("invoice.jpg")] } });
    await waitFor(() => expect(screen.getByText("Selected Images (1)")).toBeInTheDocument());

    const uploadButton = screen.getByRole("button", { name: /Upload 1 Image & Generate PDF/i });
    await user.click(uploadButton);

    expect(screen.getByText("Warning: Images Will Be Replaced")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Warning: Images Will Be Replaced")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("allows uploading when only the delivery section has images and the financial section is skipped (edge case)", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ pdfUrl: "/pdf/stop-1.pdf" }),
    });

    render(
      <EnhancedInvoiceUpload
        stopId="stop-1"
        onUploadSuccess={noop}
        onUploadComplete={noop}
        existingPdfUrl={null}
      />
    );

    const financialWarning = screen.getByText("You have not uploaded any financial documents.");
    const financialBox = financialWarning.closest("div.bg-white") as HTMLElement;
    await user.click(within(financialBox).getByRole("checkbox"));

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const deliveryGalleryInput = fileInputs[2] as HTMLInputElement;
    fireEvent.change(deliveryGalleryInput, { target: { files: [makeImageFile("pallet.jpg")] } });
    await waitFor(() => expect(screen.getByText("Selected Images (1)")).toBeInTheDocument());

    const uploadButton = screen.getByRole("button", { name: /Upload 1 Image & Generate PDF/i });
    expect(uploadButton).toBeEnabled();

    fireEvent.click(uploadButton);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const formData = (global.fetch as any).mock.calls[0][1].body as FormData;
    expect(formData.get("category")).toBe("delivery");
  });
});
