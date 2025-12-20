"use client";

import { useState, useEffect } from "react";

interface Driver {
    id: string;
    username: string;
    fullName: string | null;
}

interface AssignDriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (driverId: string, notes: string) => Promise<void>;
    currentDriverId?: string;
}

export default function AssignDriverModal({
    isOpen,
    onClose,
    onAssign,
    currentDriverId,
}: AssignDriverModalProps) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchDrivers();
            setSelectedDriverId(currentDriverId || "");
            setNotes("");
            setError("");
        }
    }, [isOpen, currentDriverId]);

    const fetchDrivers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("/api/admin/users?role=DRIVER", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch drivers");
            }

            const data = await response.json();
            setDrivers(data.users || []);
        } catch (err) {
            console.error("Error fetching drivers:", err);
            setError("Failed to load drivers");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDriverId) {
            setError("Please select a driver");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await onAssign(selectedDriverId, notes);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to assign driver");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Assign Driver
                </h3>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Driver
                        </label>
                        {loading ? (
                            <div className="text-sm text-gray-500">Loading drivers...</div>
                        ) : (
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- Select a Driver --</option>
                                {drivers.map((driver) => (
                                    <option key={driver.id} value={driver.id}>
                                        {driver.fullName || driver.username}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assignment Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Assigned for morning shift"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Assigning..." : "Assign Driver"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
