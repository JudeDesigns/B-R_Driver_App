import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SimpleSafetyChecklist from "../SimpleSafetyChecklist";

// SafetyPhotoBox performs its own network upload UI; for these tests we only
// care about the parent form's gating/warning logic, so it's stubbed out
// with a simple button that reports a fake URL back via onUploadSuccess.
jest.mock("../SafetyPhotoBox", () => {
  return function MockSafetyPhotoBox({ label, onUploadSuccess, currentUrl }: any) {
    return (
      <button
        type="button"
        onClick={() => onUploadSuccess(`https://example.com/photo.jpg`)}
      >
        {currentUrl ? `Uploaded: ${label}` : `Upload: ${label}`}
      </button>
    );
  };
});

beforeEach(() => {
  (global.fetch as any) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ documents: [] }),
  });
  (Storage.prototype.getItem as any) = jest.fn(() => "fake-token");
});

afterEach(() => {
  jest.clearAllMocks();
});

function fillAllRequiredPhotos() {
  fireEvent.click(screen.getByText("Upload: Proof of Printer Test"));
  fireEvent.click(screen.getByText(/Upload: Route Equipment/));
  fireEvent.click(screen.getByText("Upload: Front Side"));
  fireEvent.click(screen.getByText("Upload: Back Side"));
  fireEvent.click(screen.getByText("Upload: Left Side"));
  fireEvent.click(screen.getByText("Upload: Right Side"));
}

describe("SimpleSafetyChecklist (Start-of-Day)", () => {
  it("does not show the low-fuel warning by default (Full tank)", () => {
    render(<SimpleSafetyChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    expect(
      screen.queryByText(/Your fuel level is at half a tank or below/)
    ).not.toBeInTheDocument();
  });

  it.each([
    ["HALF", "1/2"],
    ["QUARTER", "1/4"],
    ["LOW", "Low - Need Fuel"],
  ])("shows the exact dispatch warning message when fuel level is set to %s", async (value) => {
    render(<SimpleSafetyChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    fireEvent.change(screen.getByLabelText("Fuel Level"), { target: { name: "fuelLevel", value } });

    expect(
      await screen.findByText(
        "Your fuel level is at half a tank or below. Please contact dispatch for a gasoline or diesel card."
      )
    ).toBeInTheDocument();
  });

  it("hides the low-fuel warning again when fuel level is changed back to Full or 3/4", async () => {
    render(<SimpleSafetyChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    const select = screen.getByLabelText("Fuel Level");

    fireEvent.change(select, { target: { name: "fuelLevel", value: "LOW" } });
    expect(await screen.findByText(/Your fuel level is at half a tank or below/)).toBeInTheDocument();

    fireEvent.change(select, { target: { name: "fuelLevel", value: "THREE_QUARTERS" } });
    await waitFor(() =>
      expect(screen.queryByText(/Your fuel level is at half a tank or below/)).not.toBeInTheDocument()
    );
  });

  it("shows the vehicle-specific fuel instructions only for LOW/QUARTER, not HALF", async () => {
    render(
      <SimpleSafetyChecklist
        onSubmit={jest.fn()}
        isSubmitting={false}
        vehicle={{ id: "v1", vehicleNumber: "T-01", fuelInstructions: "Use diesel pump #3", fuelType: "Diesel" }}
      />
    );
    const select = screen.getByLabelText("Fuel Level");

    fireEvent.change(select, { target: { name: "fuelLevel", value: "HALF" } });
    await waitFor(() => expect(screen.queryByText("Use diesel pump #3")).not.toBeInTheDocument());

    fireEvent.change(select, { target: { name: "fuelLevel", value: "QUARTER" } });
    expect(await screen.findByText("Use diesel pump #3")).toBeInTheDocument();
  });

  it("keeps the submit button disabled until every required proof photo has been uploaded", async () => {
    render(<SimpleSafetyChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    const submitButton = screen.getByRole("button", { name: /Complete Start-of-Day Check/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByText("Upload: Proof of Printer Test"));
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByText(/Upload: Route Equipment/));
    fireEvent.click(screen.getByText("Upload: Front Side"));
    fireEvent.click(screen.getByText("Upload: Back Side"));
    fireEvent.click(screen.getByText("Upload: Left Side"));
    fireEvent.click(screen.getByText("Upload: Right Side"));

    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("calls onSubmit with the complete form data (including notes) once all required fields are filled", async () => {
    const onSubmit = jest.fn();
    render(<SimpleSafetyChecklist onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText("Truck Number"), {
      target: { name: "truckNumber", value: "T-99" },
    });
    fireEvent.change(screen.getByLabelText(/Starting Odometer/), {
      target: { name: "odometerStart", value: "125432" },
    });
    fireEvent.click(screen.getByLabelText("I have printed a test page"));
    fireEvent.click(screen.getByLabelText("I have Copy Paper"));
    fireEvent.click(screen.getByLabelText("I have Staples"));
    fireEvent.click(screen.getByLabelText("I have Stapler"));
    fireEvent.change(screen.getByPlaceholderText("Any concerns or additional notes..."), {
      target: { name: "notes", value: "Truck runs fine" },
    });

    fillAllRequiredPhotos();

    const submitButton = screen.getByRole("button", { name: /Complete Start-of-Day Check/i });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.truckNumber).toBe("T-99");
    expect(submitted.odometerStart).toBe("125432");
    expect(submitted.printerTestDone).toBe(true);
    expect(submitted.hasCopyPaper).toBe(true);
    expect(submitted.notes).toBe("Truck runs fine");
    expect(submitted.printerTestPhotoUrl).toContain("https://example.com");
  });

  it("disables the submit button while isSubmitting is true, even with all fields complete", async () => {
    render(<SimpleSafetyChecklist onSubmit={jest.fn()} isSubmitting={true} />);
    fillAllRequiredPhotos();
    const submitButton = screen.getByRole("button", { name: /Submitting/i });
    expect(submitButton).toBeDisabled();
  });
});
