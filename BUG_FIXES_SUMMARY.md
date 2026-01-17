# Bug Fixes Summary

## Bug #1: Google Maps Route Shows Stops in Wrong/Messy Order ✅ FIXED

### Problem
When clicking "View Full Route in Google Maps" for a driver with multiple stops, Google Maps was **auto-optimizing** the route and showing stops in a different order than the intended delivery sequence.

### Root Cause
The old implementation used the simple URL format:
```
https://www.google.com/maps/dir/address1/address2/address3/?travelmode=driving
```

This format allows Google Maps to **automatically reorder** the stops to optimize the route, which breaks the intended delivery sequence.

### Solution
Changed to use the **Google Maps Directions API format** with explicit `origin`, `destination`, and `waypoints` parameters:
```
https://www.google.com/maps/dir/?api=1&origin=FIRST_ADDRESS&destination=LAST_ADDRESS&waypoints=MIDDLE_ADDRESSES&travelmode=driving
```

According to Google Maps documentation: *"Waypoints are displayed on the map in the same order they appear in the URL."*

### Files Changed
- `src/utils/googleMapsUtils.ts` (lines 65-124)
- `src/utils/googleMapsUtils.ts` (lines 146-173) - Fixed address extraction

### How It Works Now
1. **Sorts stops by sequence** (1, 2, 3, 4, etc.)
2. **First stop** → `origin` parameter
3. **Last stop** → `destination` parameter  
4. **Middle stops** → `waypoints` parameter (separated by `|`)
5. Google Maps displays them **in exact order** without reordering

### Example
**Before (messy order):**
```
/dir/Stop3/Stop1/Stop4/Stop2/  ← Google reorders these
```

**After (correct order):**
```
/dir/?api=1&origin=Stop1&destination=Stop4&waypoints=Stop2|Stop3&travelmode=driving
```

---

## Bug #2: Email Shows Wrong Delivery Time (UTC instead of PST) ✅ FIXED

### Problem
Delivery confirmation emails showed the wrong time:
- **Actual delivery:** 8:00 AM PST
- **Email showed:** 17:00 (5:00 PM) ← This is UTC time!

### Root Cause
The code used `.toLocaleString()` without specifying timezone:
```javascript
const deliveryTime = new Date(stop.completionTime).toLocaleString();
// ❌ Defaults to UTC or server timezone
```

### Solution
Explicitly specify PST/PDT timezone:
```javascript
const deliveryTime = new Date(stop.completionTime).toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",  // ✅ PST/PDT
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hour12: true,
});
```

### Files Changed
1. `src/app/api/admin/stops/[id]/send-email/route.ts` (lines 73-95)
2. `src/app/api/admin/routes/[id]/send-emails/route.ts` (lines 120-141)

### Example Output
**Before:** `2026-01-16 17:00:00` (UTC)  
**After:** `Jan 16, 2026, 8:00 AM` (PST)

---

## Bug #3: Grouped Table Shows Wrong Customer Name ✅ FIXED

### Problem
In the Route details page, the **grouped by driver view** showed incorrect customer names (e.g., "Jetro Van Nuys" instead of "La Palma Foods"), but the **non-grouped view** showed the correct name.

### Root Cause
The grouped view was displaying `stop.customerNameFromUpload` (raw Excel data) instead of `stop.customer.name` (actual database record).

### Solution
Changed the grouped view to match the non-grouped view by displaying:
- `stop.customer.name` (correct customer name from database)
- `stop.customer.address` (customer address)
- `stop.customer.groupCode` (customer group code)

### Files Changed
- `src/app/admin/routes/[id]/page.tsx` (lines 909-927)

---

## Testing Instructions

### Test Bug #1 (Google Maps Route Order)
1. Go to Driver Stops page (`/driver/stops`)
2. Make sure you have multiple stops with different sequences (e.g., 1, 2, 3, 4)
3. Click "🗺️ View Full Route in Google Maps"
4. **Expected:** Google Maps shows stops in exact sequence order (1 → 2 → 3 → 4)
5. **Before fix:** Google Maps might show them as (3 → 1 → 4 → 2) or any optimized order

### Test Bug #2 (Email Timezone)
1. Complete a delivery at a known PST time (e.g., 8:00 AM PST)
2. Send delivery confirmation email
3. Check the email
4. **Expected:** Shows "Jan 16, 2026, 8:00 AM" (PST time)
5. **Before fix:** Showed "17:00" or "5:00 PM" (UTC time)

### Test Bug #3 (Customer Name in Grouped View)
1. Go to Route details page (`/admin/routes/[id]`)
2. Toggle "Group by Driver" ON
3. **Expected:** Customer names match the database records
4. **Before fix:** Showed stale names from Excel upload

---

## Summary

✅ **3 bugs fixed:**
1. Google Maps route now preserves exact delivery sequence
2. Email delivery times now show in PST timezone
3. Grouped table now shows correct customer names from database

All fixes are backward compatible and don't require database changes.

