import { useState, useEffect, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";
import {
  SocketEvents,
  StopStatusUpdateData,
  RouteStatusUpdateData,
  AdminNoteData,
  DriverLocationData,
} from "@/lib/socketClient";

// Hook for stop status updates
export function useStopStatusUpdates(stopId: string | null) {
  const [statusUpdates, setStatusUpdates] = useState<StopStatusUpdateData[]>(
    []
  );
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const { subscribe, getBufferedEvents, isConnected } = useSocket();

  useEffect(() => {
    if (!stopId || !isConnected) return;

    console.log(
      "[useStopStatusUpdates] Setting up subscription for stop:",
      stopId
    );

    // Get any buffered events for this stop
    const bufferedEvents = getBufferedEvents<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED
    ).filter((event) => event.stopId === stopId);

    if (bufferedEvents.length > 0) {
      console.log(
        "[useStopStatusUpdates] Found buffered events:",
        bufferedEvents.length
      );
      setStatusUpdates((prev) => [...bufferedEvents, ...prev]);

      // Set latest status from the most recent event
      const latestEvent = bufferedEvents.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      if (latestEvent) {
        setLatestStatus(latestEvent.status);
      }
    }

    // Subscribe to new events
    const unsubscribe = subscribe<StopStatusUpdateData>(
      SocketEvents.STOP_STATUS_UPDATED,
      (data) => {
        if (data.stopId === stopId) {
          console.log(
            "[useStopStatusUpdates] Received update for stop:",
            stopId,
            data.status
          );
          setStatusUpdates((prev) => [data, ...prev]);
          setLatestStatus(data.status);
        }
      }
    );

    return () => {
      console.log(
        "[useStopStatusUpdates] Cleaning up subscription for stop:",
        stopId
      );
      unsubscribe();
    };
  }, [stopId, subscribe, getBufferedEvents, isConnected]);

  return { statusUpdates, latestStatus };
}

// Hook for route status updates
export function useRouteStatusUpdates(routeId: string | null) {
  const [statusUpdates, setStatusUpdates] = useState<RouteStatusUpdateData[]>(
    []
  );
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const { subscribe, getBufferedEvents, isConnected } = useSocket();

  useEffect(() => {
    if (!routeId || !isConnected) return;

    console.log(
      "[useRouteStatusUpdates] Setting up subscription for route:",
      routeId
    );

    // Get any buffered events for this route
    const bufferedEvents = getBufferedEvents<RouteStatusUpdateData>(
      SocketEvents.ROUTE_STATUS_UPDATED
    ).filter((event) => event.routeId === routeId);

    if (bufferedEvents.length > 0) {
      console.log(
        "[useRouteStatusUpdates] Found buffered events:",
        bufferedEvents.length
      );
      setStatusUpdates((prev) => [...bufferedEvents, ...prev]);

      // Set latest status from the most recent event
      const latestEvent = bufferedEvents.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      if (latestEvent) {
        setLatestStatus(latestEvent.status);
      }
    }

    // Subscribe to new events
    const unsubscribe = subscribe<RouteStatusUpdateData>(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data) => {
        if (data.routeId === routeId) {
          console.log(
            "[useRouteStatusUpdates] Received update for route:",
            routeId,
            data.status
          );
          setStatusUpdates((prev) => [data, ...prev]);
          setLatestStatus(data.status);
        }
      }
    );

    return () => {
      console.log(
        "[useRouteStatusUpdates] Cleaning up subscription for route:",
        routeId
      );
      unsubscribe();
    };
  }, [routeId, subscribe, getBufferedEvents, isConnected]);

  return { statusUpdates, latestStatus };
}

// Hook for admin notes
export function useAdminNotes(stopId: string | null, driverId: string | null) {
  const [notes, setNotes] = useState<AdminNoteData[]>([]);
  const [hasNewNotes, setHasNewNotes] = useState(false);
  const { subscribe, getBufferedEvents, isConnected } = useSocket();

  useEffect(() => {
    if (!stopId || !driverId || !isConnected) return;

    console.log(
      "[useAdminNotes] Setting up subscription for stop:",
      stopId,
      "driver:",
      driverId
    );

    // Get any buffered events for this stop
    const bufferedEvents = getBufferedEvents<AdminNoteData>(
      SocketEvents.ADMIN_NOTE_CREATED
    ).filter((event) => event.stopId === stopId && event.driverId === driverId);

    if (bufferedEvents.length > 0) {
      console.log(
        "[useAdminNotes] Found buffered events:",
        bufferedEvents.length
      );
      setNotes((prev) => [...bufferedEvents, ...prev]);
      setHasNewNotes(true);
    }

    // Subscribe to new events
    const unsubscribe = subscribe<AdminNoteData>(
      SocketEvents.ADMIN_NOTE_CREATED,
      (data) => {
        if (data.stopId === stopId && data.driverId === driverId) {
          console.log("[useAdminNotes] Received new note for stop:", stopId);
          setNotes((prev) => [data, ...prev]);
          setHasNewNotes(true);
        }
      }
    );

    return () => {
      console.log("[useAdminNotes] Cleaning up subscription for stop:", stopId);
      unsubscribe();
    };
  }, [stopId, driverId, subscribe, getBufferedEvents, isConnected]);

  const markNotesAsRead = useCallback(() => {
    setHasNewNotes(false);
  }, []);

  return { notes, hasNewNotes, markNotesAsRead };
}

// Hook for driver location updates
export function useDriverLocation(driverId: string | null) {
  const [location, setLocation] = useState<DriverLocationData | null>(null);
  const { subscribe, getBufferedEvents, isConnected } = useSocket();

  useEffect(() => {
    if (!driverId || !isConnected) return;

    console.log(
      "[useDriverLocation] Setting up subscription for driver:",
      driverId
    );

    // Get the most recent buffered event for this driver
    const bufferedEvents = getBufferedEvents<DriverLocationData>(
      SocketEvents.DRIVER_LOCATION_UPDATED
    ).filter((event) => event.driverId === driverId);

    if (bufferedEvents.length > 0) {
      console.log(
        "[useDriverLocation] Found buffered events:",
        bufferedEvents.length
      );

      // Get the most recent location update
      const latestEvent = bufferedEvents.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      if (latestEvent) {
        setLocation(latestEvent);
      }
    }

    // Subscribe to new events
    const unsubscribe = subscribe<DriverLocationData>(
      SocketEvents.DRIVER_LOCATION_UPDATED,
      (data) => {
        if (data.driverId === driverId) {
          console.log(
            "[useDriverLocation] Received location update for driver:",
            driverId
          );
          setLocation(data);
        }
      }
    );

    return () => {
      console.log(
        "[useDriverLocation] Cleaning up subscription for driver:",
        driverId
      );
      unsubscribe();
    };
  }, [driverId, subscribe, getBufferedEvents, isConnected]);

  return location;
}
