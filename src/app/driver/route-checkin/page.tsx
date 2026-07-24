"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SafetyPhotoBox from "@/components/driver/SafetyPhotoBox";

const CONTACT_OPTIONS = [
  "Luis Sandoval",
  "Barak",
  "Office",
  "Could not reach anyone",
];

export default function RouteCheckinPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<null | "resolved">(null);

  const [required, setRequired] = useState(false);
  const [alreadyResolved, setAlreadyResolved] = useState(false);
  const [closeoutType, setCloseoutType] = useState<"WAREHOUSE" | "JETRO" | null>(null);

  const [contactedPerson, setContactedPerson] = useState("");
  const [pendingPickup, setPendingPickup] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [checkinInstructions, setCheckinInstructions] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkAuth = () => {
      try {
        const localStorageToken = localStorage.getItem("token");
        const sessionStorageToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem("token")
            : null;
        const storedToken = sessionStorageToken || localStorageToken;

        const localStorageRole = localStorage.getItem("userRole");
        const sessionStorageRole =
          typeof window !== "undefined"
            ? sessionStorage.getItem("userRole")
            : null;
        const userRole = sessionStorageRole || localStorageRole;

        if (!storedToken || userRole !== "DRIVER") {
          router.push("/login");
        } else {
          setToken(storedToken);
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    const rid = searchParams.get("routeId");
    setRouteId(rid);
  }, [searchParams]);

  useEffect(() => {
    if (!token || !routeId) return;

    const fetchStatus = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/driver/route-checkin?routeId=${routeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to fetch check-in status"
          );
        }

        const data = await response.json();

        if (!data.required) {
          router.push("/driver/end-of-day");
          return;
        }

        setRequired(true);
        setCloseoutType(data.type);
        setAlreadyResolved(!!data.resolved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [token, routeId, router]);

  useEffect(() => {
    if (!token || !closeoutType) return;

    const fetchInstructions = async () => {
      try {
        const response = await fetch(
          `/api/driver/closeout-instructions?type=${closeoutType}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        setCheckinInstructions(data.instructions || "");
      } catch (err) {
        console.error("Error fetching check-in instructions:", err);
      }
    };

    fetchInstructions();
  }, [token, closeoutType]);

  const noteRequired = pendingPickup === false;
  const noteSatisfied = !noteRequired || note.trim().length > 0;
  // The check-in photo proves the driver is physically at the
  // warehouse/Jetro location, so it's only required when resolving the
  // check-in (pendingPickup === false). If there's still a pending pickup,
  // the driver isn't there yet, so no photo/submission is needed at all.
  const photoRequired = pendingPickup === false;

  const canSubmit =
    !submitting &&
    (!!photoUrl || !photoRequired) &&
    !!contactedPerson &&
    pendingPickup !== null &&
    noteSatisfied;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !routeId || !canSubmit) return;

    // "Yes, still a pending pickup" doesn't submit anything to the
    // server - the driver isn't at the location yet, so there's nothing
    // to record. Just confirm with the driver and send them back to the
    // dashboard; they'll come back to this page and check in for real
    // (selecting "No") once the pickup is done.
    if (pendingPickup === true) {
      const confirmed = window.confirm(
        "Confirm: there is still a pending pickup, so this route is not finished yet. You'll be taken back to the dashboard - come back to this page and check in again once the pickup is complete."
      );
      if (!confirmed) return;
      router.push("/driver");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/driver/route-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeId,
          contactedPerson,
          pendingPickup,
          note,
          photoUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to submit route check-in"
        );
      }

      setSuccess("resolved");
      setTimeout(() => {
        router.push("/driver/end-of-day");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const photoLabel =
    closeoutType === "JETRO"
      ? "Jetro Check-in Photo"
      : "Warehouse Check-in Photo";

  return (
    <div className="container mx-auto px-4 py-6 mobile-spacing prevent-pull-refresh">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-medium text-black mobile-heading">
          Route Check-in
        </h1>
        <Link
          href="/driver"
          className="text-primary-blue hover:text-blue-700 transition duration-200 font-medium touch-manipulation tap-target px-2 py-1"
        >
          &larr; Back
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden mobile-card">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-mono-200">
          <h2 className="text-base font-medium text-mono-800 mobile-text">
            {closeoutType === "JETRO" ? "Jetro" : "Warehouse"} End-of-Route
            Check-in
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
            </div>
          ) : success === "resolved" ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              Check-in submitted successfully! Redirecting to End-of-Day...
            </div>
          ) : alreadyResolved ? (
            <div className="text-center py-8">
              <p className="text-gray-700 mb-4">
                Already completed — you can proceed.
              </p>
              <Link
                href="/driver/end-of-day"
                className="inline-block bg-black hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-lg transition duration-200 touch-manipulation mobile-button"
              >
                Go to End-of-Day
              </Link>
            </div>
          ) : required ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {checkinInstructions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-600 mt-0.5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        {closeoutType === "JETRO" ? "Jetro" : "Warehouse"} Check-in
                        Instructions
                      </h3>
                      <p className="text-sm text-blue-800 mt-1 whitespace-pre-wrap">
                        {checkinInstructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="contactedPerson"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Who did you contact?
                </label>
                <select
                  id="contactedPerson"
                  name="contactedPerson"
                  value={contactedPerson}
                  onChange={(e) => setContactedPerson(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
                >
                  <option value="">-- Select --</option>
                  {CONTACT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  Is there a pending pickup?
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg flex-1 justify-center cursor-pointer">
                    <input
                      type="radio"
                      name="pendingPickup"
                      checked={pendingPickup === true}
                      onChange={() => setPendingPickup(true)}
                      required
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg flex-1 justify-center cursor-pointer">
                    <input
                      type="radio"
                      name="pendingPickup"
                      checked={pendingPickup === false}
                      onChange={() => setPendingPickup(false)}
                      required
                    />
                    No
                  </label>
                </div>
                {pendingPickup === true && (
                  <p className="text-sm text-gray-500 mt-2">
                    Select &quot;Yes&quot; only if there is still a pickup
                    left to do. After you submit, you&apos;ll need to go
                    complete that pickup and come back to check in again
                    (selecting &quot;No&quot; once it&apos;s done) before you
                    can move on to the End-of-Day Safety Check.
                  </p>
                )}
              </div>

              {pendingPickup !== true && (
                <SafetyPhotoBox
                  label={photoLabel}
                  type="route_checkin"
                  routeId={routeId || ""}
                  onUploadSuccess={(url: string) => setPhotoUrl(url)}
                  required
                  currentUrl={photoUrl}
                />
              )}

              <div>
                <label
                  htmlFor="note"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {noteRequired
                    ? "Note"
                    : "Note (optional) — what needs to be picked up / where"}
                </label>
                <textarea
                  id="note"
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  required={noteRequired}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
                  placeholder={
                    noteRequired
                      ? "Explain the outcome of your check-in..."
                      : "e.g., 3 pallets, dock door 2..."
                  }
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-4 px-8 rounded-lg transition duration-200 touch-manipulation mobile-button text-lg"
                >
                  {submitting
                    ? "Submitting..."
                    : pendingPickup === true
                    ? "Confirm & Back to Dashboard"
                    : "Submit Check-in"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
