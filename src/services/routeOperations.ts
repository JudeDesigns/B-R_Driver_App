/**
 * Service for route operations (export, email, image generation)
 * Extracted from route details page to improve modularity
 */

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  stops: any[];
}

/**
 * Export route data in CSV or JSON format
 */
export async function exportRoute(
  route: Route,
  format: 'csv' | 'json' = 'csv'
): Promise<void> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/admin/routes/${route.id}/export?format=${format}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to export route");
  }

  if (format === 'json') {
    // For JSON, download as file
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${route.routeNumber || route.id}-${new Date(route.date).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } else {
    // For CSV, the response is already set up for download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${route.routeNumber || route.id}-${new Date(route.date).toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

/**
 * Generate and download route image archive
 */
export async function generateImageReport(route: Route): Promise<void> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  // Check if route has any images
  const totalImages = route.stops.reduce((total, stop) => total + (stop.invoiceImageUrls?.length || 0), 0);

  if (totalImages === 0) {
    throw new Error("No images found in this route to archive");
  }

  const response = await fetch(`/api/admin/routes/${route.id}/generate-image-report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to generate image report");
  }

  // Download the generated archive
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `route-${route.routeNumber || route.id}-images-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Generate and download route image PDF (replaces ZIP archive)
 */
export async function generateImagePDF(route: Route): Promise<void> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  // Check if route has any images
  const totalImages = route.stops.reduce((total, stop) => total + (stop.invoiceImageUrls?.length || 0), 0);

  if (totalImages === 0) {
    throw new Error("No images found in this route to generate PDF");
  }

  // Generation can take a few minutes for routes with many images. Use an
  // AbortController with a 5-minute ceiling so we surface a clear timeout
  // message instead of the browser's generic "Failed to fetch".
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  let response: Response;
  try {
    response = await fetch(`/api/admin/routes/${route.id}/image-pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error("PDF generation timed out after 5 minutes. The route may have too many images — try again or contact support.");
    }
    throw new Error("Lost connection while generating PDF. The server may still be processing — wait a moment and check the route, or try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = "Failed to generate image PDF";
    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Non-JSON error body (e.g. proxy 504 HTML) — keep the default message.
    }
    throw new Error(message);
  }

  // Download the generated PDF
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Use the filename format: Route_[RouteNumber]_[YYYY-MM-DD].pdf
  const routeDate = new Date(route.date).toISOString().split('T')[0];
  a.download = `Route_${route.routeNumber || 'unknown'}_${routeDate}.pdf`;

  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Send bulk emails for completed stops
 */
export async function sendBulkEmails(route: Route): Promise<any> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const completedStops = route.stops.filter(stop => stop.status === 'COMPLETED');
  
  if (completedStops.length === 0) {
    throw new Error("No completed stops found to send emails for");
  }

  const response = await fetch(`/api/admin/routes/${route.id}/send-bulk-emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to send bulk emails");
  }

  return await response.json();
}

/**
 * Delete a route
 */
export async function deleteRoute(routeId: string, force: boolean = false): Promise<any> {
  // Check both localStorage and sessionStorage for token
  let token = localStorage.getItem("token");
  if (!token) {
    token = sessionStorage.getItem("token");
  }

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/admin/routes/${routeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to delete route");
  }

  return await response.json();
}
