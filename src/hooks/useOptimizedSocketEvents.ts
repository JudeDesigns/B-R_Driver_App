"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import {
  SocketEvents,
  StopStatusUpdateData,
  RouteStatusUpdateData,
  AdminNoteData,
  DriverLocationData,
} from "@/lib/socketClient";

// Debounce function to prevent multiple rapid updates
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

// Hook for optimized stop status updates
export function useOptimizedStopStatus(
  stopId: string | null,
  initialStatus: string | null = null,
  onStatusChange?: (newStatus: string) => void
) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const { subscribe, isConnected } = useSocket();

  // Update the status if initialStatus changes (e.g., from props)
  useEffect(() => {
    if (initialStatus !== null) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  // Subscribe to stop status updates
  useEffect(() => {
    if (!isConnected || !stopId) return;

    console.log(
      `[useOptimizedStopStatus] Subscribing to updates for stop: ${stopId}`
    );

    const unsubscribe = subscribe<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED,
      (data) => {
        if (data.stopId === stopId) {
          console.log(
            `[useOptimizedStopStatus] Received update for stop ${stopId}: ${data.status}`
          );

          // Update local state
          setStatus(data.status);

          // Call the callback if provided
          if (onStatusChange) {
            onStatusChange(data.status);
          }
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedStopStatus] Unsubscribing from updates for stop: ${stopId}`
      );
      unsubscribe();
    };
  }, [stopId, isConnected, subscribe, onStatusChange]);

  return { status };
}

// Hook for optimized route status updates
export function useOptimizedRouteStatus(
  routeId: string | null,
  initialStatus: string | null = null,
  onStatusChange?: (newStatus: string) => void
) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const { subscribe, isConnected } = useSocket();

  // Update the status if initialStatus changes
  useEffect(() => {
    if (initialStatus !== null) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  // Subscribe to route status updates
  useEffect(() => {
    if (!isConnected || !routeId) return;

    console.log(
      `[useOptimizedRouteStatus] Subscribing to updates for route: ${routeId}`
    );

    const unsubscribe = subscribe<RouteStatusUpdateData>(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data) => {
        if (data.routeId === routeId) {
          console.log(
            `[useOptimizedRouteStatus] Received update for route ${routeId}: ${data.status}`
          );

          // Update local state
          setStatus(data.status);

          // Call the callback if provided
          if (onStatusChange) {
            onStatusChange(data.status);
          }
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedRouteStatus] Unsubscribing from updates for route: ${routeId}`
      );
      unsubscribe();
    };
  }, [routeId, isConnected, subscribe, onStatusChange]);

  return { status };
}

// Hook for optimized admin notes
export function useOptimizedAdminNotes(
  stopId: string | null,
  initialNotes: AdminNoteData[] = [],
  onNewNote?: (note: AdminNoteData) => void
) {
  const [notes, setNotes] = useState<AdminNoteData[]>(initialNotes);
  const [hasNewNotes, setHasNewNotes] = useState(false);
  const { subscribe, isConnected } = useSocket();

  // Update notes if initialNotes changes
  useEffect(() => {
    if (initialNotes.length > 0) {
      setNotes(initialNotes);
    }
  }, [initialNotes]);

  // Subscribe to admin note events
  useEffect(() => {
    if (!isConnected || !stopId) return;

    console.log(
      `[useOptimizedAdminNotes] Subscribing to notes for stop: ${stopId}`
    );

    const unsubscribe = subscribe<AdminNoteData>(
      SocketEvents.ADMIN_NOTE_CREATED,
      (data) => {
        if (data.stopId === stopId) {
          console.log(
            `[useOptimizedAdminNotes] Received new note for stop ${stopId}: "${data.note}"`
          );

          // Update local state by adding the new note to the beginning of the array
          setNotes((prevNotes) => {
            console.log(
              `[useOptimizedAdminNotes] Adding new note to local state for stop ${stopId}`
            );
            return [data, ...prevNotes];
          });
          setHasNewNotes(true);

          // Call the callback if provided
          if (onNewNote) {
            console.log(
              `[useOptimizedAdminNotes] Calling onNewNote callback for stop ${stopId}`
            );
            onNewNote(data);
          }
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedAdminNotes] Unsubscribing from notes for stop: ${stopId}`
      );
      unsubscribe();
    };
  }, [stopId, isConnected, subscribe, onNewNote]);

  const markNotesAsRead = useCallback(() => {
    setHasNewNotes(false);
  }, []);

  return { notes, hasNewNotes, markNotesAsRead };
}

// Hook for optimized stop list updates
export function useOptimizedStopList(
  routeId: string | null,
  initialStops: any[] = [],
  fetchAllStops?: () => Promise<void>
) {
  const [stops, setStops] = useState<any[]>(initialStops);
  const { subscribe, isConnected } = useSocket();

  // Debounced fetch function to prevent multiple rapid fetches
  const debouncedFetch = useDebounce(() => {
    if (fetchAllStops) {
      fetchAllStops();
    }
  }, 1000);

  // Update stops if initialStops changes
  useEffect(() => {
    if (initialStops.length > 0) {
      setStops(initialStops);
    }
  }, [initialStops]);

  // Subscribe to stop status updates
  useEffect(() => {
    if (!isConnected || !routeId) return;

    console.log(
      `[useOptimizedStopList] Subscribing to updates for route: ${routeId}`
    );

    const unsubscribeStopStatus = subscribe<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED,
      (data) => {
        if (data.routeId === routeId) {
          console.log(
            `[useOptimizedStopList] Received stop status update for route ${routeId}`
          );

          // Try to update the specific stop in the list
          setStops((prevStops) =>
            prevStops.map((stop) =>
              stop.id === data.stopId ? { ...stop, status: data.status } : stop
            )
          );
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedStopList] Unsubscribing from updates for route: ${routeId}`
      );
      unsubscribeStopStatus();
    };
  }, [routeId, isConnected, subscribe]);

  return { stops };
}

// Hook for optimized route details
export function useOptimizedRouteDetails(
  routeId: string | null,
  initialRoute: any | null = null
) {
  const [route, setRoute] = useState<any | null>(initialRoute);
  const { subscribe, isConnected } = useSocket();

  // Update route if initialRoute changes
  useEffect(() => {
    if (initialRoute) {
      setRoute(initialRoute);
    }
  }, [initialRoute]);

  // Subscribe to route and stop status updates
  useEffect(() => {
    if (!isConnected || !routeId || !route) return;

    console.log(
      `[useOptimizedRouteDetails] Subscribing to updates for route: ${routeId}`
    );

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED,
      (data) => {
        if (data.routeId === routeId) {
          console.log(
            `[useOptimizedRouteDetails] Received stop status update for route ${routeId}`
          );

          // Update the specific stop in the route
          setRoute((prevRoute: any) => {
            if (!prevRoute || !prevRoute.stops) return prevRoute;

            return {
              ...prevRoute,
              stops: prevRoute.stops.map((stop: any) =>
                stop.id === data.stopId
                  ? { ...stop, status: data.status }
                  : stop
              ),
            };
          });
        }
      }
    );

    // Subscribe to route status update events
    const unsubscribeRouteStatus = subscribe<RouteStatusUpdateData>(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data) => {
        if (data.routeId === routeId) {
          console.log(
            `[useOptimizedRouteDetails] Received route status update for route ${routeId}`
          );

          // Update the route status
          setRoute((prevRoute: any) => {
            if (!prevRoute) return prevRoute;

            return {
              ...prevRoute,
              status: data.status,
            };
          });
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedRouteDetails] Unsubscribing from updates for route: ${routeId}`
      );
      unsubscribeStopStatus();
      unsubscribeRouteStatus();
    };
  }, [routeId, isConnected, subscribe, route]);

  return { route };
}

// Hook for optimized admin stop details
export function useOptimizedAdminStopDetails(
  stopId: string | null,
  initialStop: any | null = null
) {
  const [stop, setStop] = useState<any | null>(initialStop);
  const { subscribe, isConnected } = useSocket();

  // Update stop if initialStop changes
  useEffect(() => {
    if (initialStop) {
      setStop(initialStop);
    }
  }, [initialStop]);

  // Subscribe to stop status updates
  useEffect(() => {
    if (!isConnected || !stopId) return;

    console.log(
      `[useOptimizedAdminStopDetails] Subscribing to updates for stop: ${stopId}`
    );

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED,
      (data) => {
        if (data.stopId === stopId) {
          console.log(
            `[useOptimizedAdminStopDetails] Received status update for stop ${stopId}: ${data.status}`
          );

          // Update the stop status
          setStop((prevStop: any) => {
            if (!prevStop) return prevStop;

            console.log(
              `[useOptimizedAdminStopDetails] Updating stop status from ${prevStop.status} to ${data.status}`
            );

            return {
              ...prevStop,
              status: data.status,
            };
          });
        }
      }
    );

    // Subscribe to admin note events
    const unsubscribeAdminNote = subscribe<AdminNoteData>(
      SocketEvents.ADMIN_NOTE_CREATED,
      (data) => {
        if (data.stopId === stopId) {
          console.log(
            `[useOptimizedAdminStopDetails] Received new admin note for stop ${stopId}`
          );

          // Update the admin notes
          setStop((prevStop: any) => {
            if (!prevStop) return prevStop;

            console.log(
              `[useOptimizedAdminStopDetails] Adding new admin note to stop ${stopId}`
            );

            return {
              ...prevStop,
              adminNotes: [data, ...(prevStop.adminNotes || [])],
            };
          });
        }
      }
    );

    return () => {
      console.log(
        `[useOptimizedAdminStopDetails] Unsubscribing from updates for stop: ${stopId}`
      );
      unsubscribeStopStatus();
      unsubscribeAdminNote();
    };
  }, [stopId, isConnected, subscribe]);

  return { stop };
}
