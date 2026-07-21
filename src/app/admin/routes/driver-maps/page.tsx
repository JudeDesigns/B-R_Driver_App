"use client";

import { useEffect, useState } from "react";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";
import { fetchDrivers } from "@/services/stopOperations";
import {
  extractRouteDataFromStops,
  generateFullRouteMapLink,
} from "@/utils/googleMapsUtils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Driver {
  id: string;
  username: string;
  fullName: string | null;
}

interface Customer {
  id: string;
  name: string;
  address: string | null;
}

interface Stop {
  id: string;
  sequence: number;
  address: string | null;
  driverNameFromUpload: string | null;
  status: string;
  customer: Customer;
}

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  } | null;
  stops: Stop[];
}

export default function DriverRouteMapsPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAdminAuth();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Per-driver-group stop order, keyed by `${routeId}::${driverKey}`
  const [groupStops, setGroupStops] = useState<Record<string, Stop[]>>({});
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (token && isAuthenticated) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [routesRes, driversData] = await Promise.all([
        fetch("/api/admin/routes/today", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchDrivers(),
      ]);

      if (!routesRes.ok) {
        throw new Error("Failed to fetch today's routes");
      }

      const routesData: Route[] = await routesRes.json();
      setRoutes(routesData);
      setDrivers(driversData);

      // Initialize per-driver-group stop order from the grouping algorithm
      const initialGroupStops: Record<string, Stop[]> = {};
      routesData.forEach((route) => {
        const grouped = groupStopsByDriver(route, driversData);
        Object.entries(grouped).forEach(([driverKey, stops]) => {
          initialGroupStops[`${route.id}::${driverKey}`] = stops;
        });
      });
      setGroupStops(initialGroupStops);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Group a route's stops by driver, using the same case-insensitive
  // normalization approach used elsewhere in the app (see
  // getStopsGroupedByDriver in /admin/routes/[id]/page.tsx).
  const groupStopsByDriver = (
    route: Route,
    driverList: Driver[]
  ): Record<string, Stop[]> => {
    const driverLookup = new Map<string, string>();
    driverList.forEach((d) => {
      driverLookup.set(d.username.toLowerCase(), d.username);
      if (d.fullName) driverLookup.set(d.fullName.toLowerCase(), d.username);
    });
    if (route.driver) {
      driverLookup.set(route.driver.username.toLowerCase(), route.driver.username);
      if (route.driver.fullName) {
        driverLookup.set(route.driver.fullName.toLowerCase(), route.driver.username);
      }
    }

    const grouped: Record<string, Stop[]> = {};
    route.stops.forEach((stop) => {
      const raw = stop.driverNameFromUpload || route.driver?.username || "Unassigned";
      const driverKey = driverLookup.get(raw.trim().toLowerCase()) ?? raw.trim();
      if (!grouped[driverKey]) {
        grouped[driverKey] = [];
      }
      grouped[driverKey].push(stop);
    });

    Object.keys(grouped).forEach((driverKey) => {
      grouped[driverKey].sort((a, b) => a.sequence - b.sequence);
    });

    return grouped;
  };

  const getDriverDisplayName = (driverKey: string): string => {
    const match = drivers.find((d) => d.username === driverKey);
    return match?.fullName || match?.username || driverKey;
  };

  const handleOpenMap = (stops: Stop[]) => {
    const routeData = extractRouteDataFromStops(
      stops.map((s) => ({
        sequence: s.sequence,
        address: s.address || undefined,
        customer: {
          name: s.customer.name,
          address: s.customer.address || undefined,
        },
      }))
    );
    const url = generateFullRouteMapLink(routeData);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDragEnd = async (
    routeId: string,
    driverKey: string,
    event: DragEndEvent
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupKey = `${routeId}::${driverKey}`;
    const currentStops = groupStops[groupKey] || [];
    const oldIndex = currentStops.findIndex((s) => s.id === active.id);
    const newIndex = currentStops.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentStops, oldIndex, newIndex);
    const previousStops = currentStops;

    // Optimistic update
    setGroupStops((prev) => ({ ...prev, [groupKey]: reordered }));
    setGroupErrors((prev) => ({ ...prev, [groupKey]: "" }));

    try {
      const response = await fetch(
        `/api/admin/routes/${routeId}/reorder-driver-stops`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ stopIds: reordered.map((s) => s.id) }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reorder stops");
      }
    } catch (err) {
      // Revert on failure
      setGroupStops((prev) => ({ ...prev, [groupKey]: previousStops }));
      setGroupErrors((prev) => ({
        ...prev,
        [groupKey]: err instanceof Error ? err.message : "Failed to reorder stops",
      }));
    }
  };

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Route Maps</h1>
        <p className="text-gray-600 mt-1">
          Review each driver's stop order for today's routes and open the full route in Google Maps.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading today's routes...</p>
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
          No routes scheduled for today.
        </div>
      ) : (
        <div className="space-y-6">
          {routes.map((route) => {
            const grouped = groupStopsByDriver(route, drivers);
            const driverKeys = Object.keys(grouped);

            return (
              <div
                key={route.id}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Route {route.routeNumber || route.id.slice(0, 8)}
                  </h2>
                  <span className="text-sm text-gray-300">
                    {new Date(route.date).toLocaleDateString()}
                  </span>
                </div>

                <div className="p-6 space-y-8">
                  {driverKeys.map((driverKey) => {
                    const groupKey = `${route.id}::${driverKey}`;
                    const stops = groupStops[groupKey] || grouped[driverKey];
                    const displayName = getDriverDisplayName(driverKey);

                    return (
                      <div
                        key={groupKey}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <h3 className="text-md font-semibold text-gray-900">
                            {displayName}{" "}
                            <span className="text-sm font-normal text-gray-500">
                              ({stops.length} stop{stops.length !== 1 ? "s" : ""})
                            </span>
                          </h3>
                          <button
                            onClick={() => handleOpenMap(stops)}
                            className="inline-flex items-center px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                          >
                            Open Full Route in Google Maps
                          </button>
                        </div>

                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) =>
                            handleDragEnd(route.id, driverKey, event)
                          }
                        >
                          <SortableContext
                            items={stops.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {stops.map((stop, index) => (
                                <SortableStopRow
                                  key={stop.id}
                                  stop={stop}
                                  position={index + 1}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>

                        {groupErrors[groupKey] && (
                          <p className="mt-2 text-sm text-red-600">
                            {groupErrors[groupKey]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortableStopRow({
  stop,
  position,
}: {
  stop: Stop;
  position: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-md border ${
        isDragging ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-gray-100"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold flex-shrink-0">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 truncate">
          {stop.customer?.name}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {stop.address || stop.customer?.address || "No address"}
        </div>
      </div>
    </div>
  );
}
