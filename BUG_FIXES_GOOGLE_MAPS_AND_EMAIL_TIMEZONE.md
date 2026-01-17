# Bug Fixes: Google Maps Route & Email Timezone

## Bug #1: Google Maps Route Not Populating for Multiple Stops

### Problem
When clicking "View Full Route in Google Maps" for a driver with multiple stops, the route doesn't populate properly in Google Maps.

### Root Cause
The `extractRouteDataFromStops` function in `src/utils/googleMapsUtils.ts` was expecting `stop.address` but the Stop interface has the address nested under `stop.customer.address`.

**Code Issue:**
```typescript
// BEFORE (WRONG):
.filter(stop => isValidAddressForMaps(stop.address))  // ❌ stop.address doesn't exist
.map(stop => ({
  address: stop.address,  // ❌ undefined
  customerName: stop.customer.name,
  sequence: stop.sequence
}));
```

### Fix Applied
**File:** `src/utils/googleMapsUtils.ts` (lines 146-173)

Updated the function to check both `stop.address` and `stop.customer.address`:

```typescript
// AFTER (FIXED):
.filter(stop => {
  const address = stop.address || stop.customer.address || '';
  return isValidAddressForMaps(address);
})
.map(stop => ({
  address: stop.address || stop.customer.address || '',  // ✅ Checks both
  customerName: stop.customer.name,
  sequence: stop.sequence
}));
```

### Testing
1. Go to Driver Stops page (`/driver/stops`)
2. Click "View Full Route in Google Maps"
3. Google Maps should now open with all stops properly populated in the route

---

## Bug #2: Email Shows Wrong Delivery Time (UTC instead of PST)

### Problem
Delivery confirmation emails show the wrong time. For example:
- **Actual delivery time:** 8:00 AM PST
- **Email shows:** 17:00 (5:00 PM) - This is UTC time

### Root Cause
The `toLocaleString()` method was called without specifying the timezone, so it defaulted to UTC or the server's timezone instead of PST.

**Code Issue:**
```typescript
// BEFORE (WRONG):
const deliveryTime = stop.completionTime
  ? new Date(stop.completionTime).toLocaleString()  // ❌ No timezone specified
  : new Date().toLocaleString();
```

This converts the time to UTC or server timezone, which is 8-9 hours ahead of PST, explaining why 8:00 AM shows as 17:00 (5:00 PM).

### Fix Applied
**Files Fixed:**
1. `src/app/api/admin/stops/[id]/send-email/route.ts` (lines 73-95)
2. `src/app/api/admin/routes/[id]/send-emails/route.ts` (lines 120-141)

Updated to explicitly specify PST timezone:

```typescript
// AFTER (FIXED):
const deliveryTime = stop.completionTime
  ? new Date(stop.completionTime).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",  // ✅ PST/PDT timezone
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    })
  : new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
```

### Example Output
**Before:** `2026-01-16 17:00:00` (UTC)
**After:** `Jan 16, 2026, 8:00 AM` (PST)

### Testing
1. Complete a delivery at a known time (e.g., 8:00 AM PST)
2. Send the delivery confirmation email
3. Check the email - it should now show the correct PST time (8:00 AM) instead of UTC time (17:00)

---

## Summary

✅ **Bug #1 Fixed:** Google Maps route now properly populates with all driver stops
✅ **Bug #2 Fixed:** Email delivery times now show in PST timezone instead of UTC

Both bugs are now resolved and ready for testing!

