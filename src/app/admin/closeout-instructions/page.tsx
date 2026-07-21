"use client";

import { useState, useEffect } from "react";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

const MAX_INSTRUCTIONS_LENGTH = 5000;

interface InstructionsData {
  instructions: string;
  updatedAt: string;
  updatedBy: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

type CloseoutType = "WAREHOUSE" | "JETRO";

function InstructionsSection({
  type,
  title,
  token,
  data,
  onSaved,
}: {
  type: CloseoutType;
  title: string;
  token: string | null;
  data: InstructionsData | null;
  onSaved: (type: CloseoutType, updated: InstructionsData) => void;
}) {
  const [text, setText] = useState(data?.instructions || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    setText(data?.instructions || "");
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/closeout-instructions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, instructions: text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save instructions");
      }

      const updated = await response.json();
      onSaved(type, {
        instructions: updated.instructions,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updater,
      });
      setMessage({ type: "success", text: "Instructions saved successfully." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={MAX_INSTRUCTIONS_LENGTH}
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        placeholder="Enter the instructions drivers should see during this check-in..."
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-gray-500">
          {text.length} / {MAX_INSTRUCTIONS_LENGTH} characters
        </span>
      </div>

      {data?.updatedBy && (
        <p className="text-xs text-gray-500 mt-2">
          Last updated by {data.updatedBy.fullName || data.updatedBy.username} on{" "}
          {new Date(data.updatedAt).toLocaleString()}
        </p>
      )}

      {message && (
        <div
          className={`mt-3 px-4 py-2 rounded text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function CloseoutInstructionsPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [instructionsByType, setInstructionsByType] = useState<
    Record<CloseoutType, InstructionsData | null>
  >({ WAREHOUSE: null, JETRO: null });

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchInstructions();
    }
  }, [token, isAuthenticated]);

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/closeout-instructions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch instructions");
      }

      const data = await response.json();
      setInstructionsByType({
        WAREHOUSE: data.WAREHOUSE || null,
        JETRO: data.JETRO || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (type: CloseoutType, updated: InstructionsData) => {
    setInstructionsByType((prev) => ({ ...prev, [type]: updated }));
  };

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Check-in Instructions</h1>
          <p className="text-gray-600 mt-2">
            These instructions are shown to drivers when they perform a Warehouse or
            Jetro check-in at the end of their route.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading instructions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <InstructionsSection
              type="WAREHOUSE"
              title="Warehouse Check-in Instructions"
              token={token}
              data={instructionsByType.WAREHOUSE}
              onSaved={handleSaved}
            />
            <InstructionsSection
              type="JETRO"
              title="Jetro Check-in Instructions"
              token={token}
              data={instructionsByType.JETRO}
              onSaved={handleSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
