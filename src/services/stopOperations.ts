/**
 * Service for stop operations (add, update, sequence management)
 * Extracted from route details page to improve modularity
 */

interface AddStopForm {
  customerNameFromUpload: string;
  driverId: string;
  orderNumberWeb: string;
  quickbooksInvoiceNum: string;
  initialDriverNotes: string;
  isCOD: boolean;
  amount: string;
  address: string;
  contactInfo: string;
}

/**
 * Add a new stop to a route
 */
export async function addStop(routeId: string, stopData: AddStopForm): Promise<any> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/admin/routes/${routeId}/stops`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...stopData,
      amount: stopData.amount ? parseFloat(stopData.amount) : null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to add stop");
  }

  return await response.json();
}

/**
 * Update stop sequence
 */
export async function updateStopSequence(
  routeId: string,
  stopId: string,
  newSequence: number
): Promise<any> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/admin/stops/${stopId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sequence: newSequence }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to update stop sequence";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (parseError) {
      // If we can't parse the response as JSON, it might be HTML (error page)
      const errorText = await response.text();
      if (errorText.includes("<!DOCTYPE")) {
        errorMessage = `Server error (${response.status}): The server returned an error page instead of JSON. This might be a routing or server configuration issue.`;
      } else {
        errorMessage = `Server error (${response.status}): ${errorText}`;
      }
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Update stop driver assignment
 */
export async function updateStopDriver(
  routeId: string,
  stopId: string,
  newDriverName: string
): Promise<any> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/admin/routes/${routeId}/stops/${stopId}/driver`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ driverNameFromUpload: newDriverName }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update stop driver");
  }

  return await response.json();
}

/**
 * Fetch drivers list
 */
export async function fetchDrivers(): Promise<any[]> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/admin/drivers", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch drivers");
  }

  return await response.json();
}
