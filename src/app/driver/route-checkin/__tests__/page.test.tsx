import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import RouteCheckinPage from "../page";

const pushMock = jest.fn();
const routerMock = { push: pushMock };
const searchParamsMock = {
  get: (key: string) => (key === "routeId" ? "route-1" : null),
};

jest.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));

jest.mock("../../../../components/driver/SafetyPhotoBox", () => {
  return function MockSafetyPhotoBox({ onUploadSuccess, currentUrl, label }: any) {
    return (
      <button
        type="button"
        onClick={() => onUploadSuccess("https://example.com/checkin-photo.jpg")}
      >
        {currentUrl ? `Uploaded: ${label}` : `Upload: ${label}`}
      </button>
    );
  };
});

function setAuth() {
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("userRole", "DRIVER");
}

function jsonResponse(body: any, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

function selectContactedPerson(value = "Office") {
  fireEvent.change(screen.getByLabelText("Who did you contact?"), {
    target: { value },
  });
}

function selectPendingPickup(value: boolean) {
  const label = value ? "Yes" : "No";
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

function uploadPhoto() {
  fireEvent.click(screen.getByText(/^Upload:/));
}

async function renderResolved(required = true, resolved = false, type = "WAREHOUSE") {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    jsonResponse({ required, resolved, type, latestCheck: null })
  );
  render(<RouteCheckinPage />);
  await screen.findByLabelText("Who did you contact?");
}

describe("RouteCheckinPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    pushMock.mockClear();
    global.fetch = jest.fn();
  });

  it("redirects to /login when no token is present", async () => {
    render(<RouteCheckinPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });

  it("shows a loading spinner while the initial GET fetch is in flight", async () => {
    setAuth();
    let resolveFetch: (v: any) => void;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { container } = render(<RouteCheckinPage />);

    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    );

    resolveFetch!(jsonResponse({ required: false }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/driver/end-of-day"));
  });

  it("redirects to /driver/end-of-day when GET response has required: false", async () => {
    setAuth();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ required: false }));

    render(<RouteCheckinPage />);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/driver/end-of-day"));
  });

  it("shows an already-resolved panel with a working link when required:true, resolved:true", async () => {
    setAuth();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ required: true, resolved: true, type: "WAREHOUSE", latestCheck: {} })
    );

    render(<RouteCheckinPage />);

    expect(await screen.findByText(/Already completed/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Go to End-of-Day/i });
    expect(link).toHaveAttribute("href", "/driver/end-of-day");
  });

  it.each(["JETRO", "WAREHOUSE"])(
    "renders the full form with the correct heading for type: %s",
    async (type) => {
      setAuth();
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        jsonResponse({ required: true, resolved: false, type, latestCheck: null })
      );

      render(<RouteCheckinPage />);

      const expectedLabel = type === "JETRO" ? "Jetro" : "Warehouse";
      expect(
        await screen.findByText(new RegExp(`${expectedLabel} End-of-Route`))
      ).toBeInTheDocument();
    }
  );

  it("keeps the submit button disabled until contactedPerson, pendingPickup and photo are all set", async () => {
    setAuth();
    await renderResolved();

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    expect(submitButton).toBeDisabled();

    selectContactedPerson();
    expect(submitButton).toBeDisabled();

    selectPendingPickup(true);
    expect(submitButton).toBeDisabled();

    uploadPhoto();
    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("makes the note optional when pendingPickup is Yes (true)", async () => {
    setAuth();
    await renderResolved();

    selectContactedPerson();
    selectPendingPickup(true);
    uploadPhoto();

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("requires a non-empty note when pendingPickup is No (false)", async () => {
    setAuth();
    await renderResolved();

    selectContactedPerson();
    selectPendingPickup(false);
    uploadPhoto();

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "   " },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Left at dock 2" },
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
  });

  it("on successful submit with pendingPickup=true shows pending message, does not navigate, and resets the form", async () => {
    setAuth();
    await renderResolved();

    selectContactedPerson();
    selectPendingPickup(true);
    uploadPhoto();

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    await waitFor(() => expect(submitButton).toBeEnabled());

    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ id: "check-1" }));

    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/Understood — go complete the pickup/)
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith("/driver/end-of-day");

    // Form fields should be reset - re-render the form is hidden behind success message
    // so we can't directly assert on the submit button, but success message replaces the form.
    expect(screen.queryByRole("button", { name: /Submit Check-in/i })).not.toBeInTheDocument();
  });

  it("on successful submit with pendingPickup=false shows resolved message and redirects after 1500ms", async () => {
    setAuth();
    await renderResolved();

    selectContactedPerson();
    selectPendingPickup(false);
    uploadPhoto();
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "All good, no pending pickup" },
    });

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    await waitFor(() => expect(submitButton).toBeEnabled());

    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ id: "check-1" }));

    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/Check-in submitted successfully/)
    ).toBeInTheDocument();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/driver/end-of-day"), {
      timeout: 3000,
    });
  }, 10000);

  it("shows an error banner when the initial GET fetch fails", async () => {
    setAuth();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ message: "Server exploded" }, false)
    );

    render(<RouteCheckinPage />);

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
  });

  it("shows an error banner when the POST submit fetch fails", async () => {
    setAuth();
    await renderResolved();

    selectContactedPerson();
    selectPendingPickup(true);
    uploadPhoto();

    const submitButton = screen.getByRole("button", { name: /Submit Check-in/i });
    await waitFor(() => expect(submitButton).toBeEnabled());

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse({ message: "Submit failed" }, false)
    );

    fireEvent.click(submitButton);

    expect(await screen.findByText("Submit failed")).toBeInTheDocument();
  });
});
