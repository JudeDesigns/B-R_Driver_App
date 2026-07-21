import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SimpleEndOfDayChecklist from "../SimpleEndOfDayChecklist";

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

function fillAllRequiredPhotos() {
  fireEvent.click(screen.getByText(/Upload: Equipment/));
  fireEvent.click(screen.getByText(/Upload: Power Converter/));
  fireEvent.click(screen.getByText(/Upload: Dashboard/));
  fireEvent.click(screen.getByText("Upload: Front Side"));
  fireEvent.click(screen.getByText("Upload: Back Side"));
  fireEvent.click(screen.getByText("Upload: Left Side"));
  fireEvent.click(screen.getByText("Upload: Right Side"));
}

describe("SimpleEndOfDayChecklist", () => {
  it("does not show the low-fuel warning by default (Full tank)", () => {
    render(<SimpleEndOfDayChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    expect(
      screen.queryByText(/Your fuel level is at half a tank or below/)
    ).not.toBeInTheDocument();
  });

  it.each(["1/2", "1/4", "EMPTY"])(
    "shows the exact dispatch warning message when fuel level is set to %s",
    async (value) => {
      render(<SimpleEndOfDayChecklist onSubmit={jest.fn()} isSubmitting={false} />);
      fireEvent.change(screen.getByLabelText("Fuel Level"), { target: { name: "fuelLevel", value } });

      expect(
        await screen.findByText(
          "Your fuel level is at half a tank or below. Please contact dispatch for a gasoline or diesel card."
        )
      ).toBeInTheDocument();
    }
  );

  it("hides the warning again when fuel level goes back to Full or 3/4", async () => {
    render(<SimpleEndOfDayChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    const select = screen.getByLabelText("Fuel Level");

    fireEvent.change(select, { target: { name: "fuelLevel", value: "EMPTY" } });
    expect(await screen.findByText(/Your fuel level is at half a tank or below/)).toBeInTheDocument();

    fireEvent.change(select, { target: { name: "fuelLevel", value: "3/4" } });
    await waitFor(() =>
      expect(screen.queryByText(/Your fuel level is at half a tank or below/)).not.toBeInTheDocument()
    );
  });

  it("keeps the submit button disabled until all required end-of-day photos are uploaded", async () => {
    render(<SimpleEndOfDayChecklist onSubmit={jest.fn()} isSubmitting={false} />);
    const submitButton = screen.getByRole("button", { name: /Complete End-of-Day Check/i });
    expect(submitButton).toBeDisabled();

    fillAllRequiredPhotos();

    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("submits notes (used for the admin 'Driver Warning' panel) along with the rest of the form", async () => {
    const onSubmit = jest.fn();
    render(<SimpleEndOfDayChecklist onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText("Truck Number"), {
      target: { name: "truckNumber", value: "T-01" },
    });
    fireEvent.change(screen.getByLabelText(/Ending Odometer/), {
      target: { name: "odometerEnd", value: "125650" },
    });
    fireEvent.change(screen.getByPlaceholderText("Any additional notes or observations..."), {
      target: { name: "notes", value: "Truck has a squeaky brake, please inform dispatch" },
    });

    fillAllRequiredPhotos();
    const submitButton = screen.getByRole("button", { name: /Complete End-of-Day Check/i });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].notes).toBe("Truck has a squeaky brake, please inform dispatch");
  });

  it("allows submitting with empty notes (notes are optional)", async () => {
    const onSubmit = jest.fn();
    render(<SimpleEndOfDayChecklist onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText("Truck Number"), {
      target: { name: "truckNumber", value: "T-01" },
    });
    fireEvent.change(screen.getByLabelText(/Ending Odometer/), {
      target: { name: "odometerEnd", value: "125650" },
    });

    fillAllRequiredPhotos();
    const submitButton = screen.getByRole("button", { name: /Complete End-of-Day Check/i });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].notes).toBe("");
  });
});
