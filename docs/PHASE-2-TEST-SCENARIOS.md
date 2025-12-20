# Phase 2: Attendance Integration - Test Scenarios

**Date:** 2025-11-20  
**Status:** Testing in Progress

---

## 🧪 Test Scenarios Overview

This document outlines comprehensive test scenarios to verify the attendance integration functionality before moving to Phase 3.

---

## Test Scenario 1: Attendance API Available - Driver Clocked In ✅

**Objective:** Verify that when attendance API returns clocked in status, driver can access routes and sees green banner.

### Prerequisites:
- Attendance API is running and accessible
- Driver user exists in database
- Driver is clocked in at attendance app

### Test Steps:

1. **Setup Mock Attendance API Response:**
   ```json
   POST /api/attendance/status
   Response: {
     "isClockedIn": true,
     "clockInTime": "2025-11-20T08:00:00Z"
   }
   ```

2. **Login as Driver:**
   - Navigate to `/login`
   - Login with driver credentials
   - Should redirect to `/driver`

3. **Verify Dashboard Display:**
   - Should see green attendance banner
   - Banner should show: "You are clocked in"
   - Icon should be green checkmark
   - Should show enforcement mode and source

4. **Verify API Access:**
   - Navigate to `/driver/stops`
   - Should load successfully
   - No blocking or warnings

5. **Verify Console Logs:**
   - Should see: `[Attendance] Fetching status from API for [username]`
   - Should see: `[Attendance] Driver [username] is clocked in`

### Expected Results:
- ✅ Driver can access all routes
- ✅ Green banner displayed on dashboard
- ✅ No blocking or errors
- ✅ Status cached in database

---

## Test Scenario 2: Attendance API Available - Driver Not Clocked In ⚠️

**Objective:** Verify that in permissive mode, driver can still access routes but sees yellow warning banner.

### Prerequisites:
- Attendance API is running and accessible
- Driver user exists in database
- Driver is NOT clocked in at attendance app
- `ATTENDANCE_ENFORCEMENT_MODE=permissive`

### Test Steps:

1. **Setup Mock Attendance API Response:**
   ```json
   POST /api/attendance/status
   Response: {
     "isClockedIn": false,
     "clockInTime": null
   }
   ```

2. **Login as Driver:**
   - Navigate to `/login`
   - Login with driver credentials
   - Should redirect to `/driver`

3. **Verify Dashboard Display:**
   - Should see yellow attendance banner
   - Banner should show warning message
   - Icon should be yellow warning triangle
   - Should show enforcement mode: "permissive"

4. **Verify API Access:**
   - Navigate to `/driver/stops`
   - Should load successfully (permissive mode)
   - No blocking

5. **Verify Console Logs:**
   - Should see: `[Attendance] Driver [username] is NOT clocked in`
   - Should see: `[Attendance] Enforcement mode: permissive - allowing access`

### Expected Results:
- ✅ Driver can still access routes (permissive mode)
- ✅ Yellow warning banner displayed
- ✅ Warning logged to console
- ✅ No blocking

---

## Test Scenario 3: Attendance API Unavailable 🔴

**Objective:** Verify fallback mode allows access when API is down, with appropriate warning.

### Prerequisites:
- Attendance API is NOT running or unreachable
- `ATTENDANCE_API_FALLBACK_MODE=permissive`

### Test Steps:

1. **Stop Attendance API:**
   - Ensure attendance API is not accessible
   - Or set invalid `ATTENDANCE_API_URL`

2. **Login as Driver:**
   - Navigate to `/login`
   - Login with driver credentials
   - Should redirect to `/driver`

3. **Verify Dashboard Display:**
   - Should see yellow/orange banner
   - Banner should indicate API unavailable
   - Should show source: "fallback"

4. **Verify API Access:**
   - Navigate to `/driver/stops`
   - Should load successfully (fallback permissive mode)
   - No blocking

5. **Verify Console Logs:**
   - Should see: `[Attendance] Error checking status`
   - Should see: `[Attendance] Using fallback mode: permissive`

### Expected Results:
- ✅ Driver can access routes (fallback permissive)
- ✅ Warning banner displayed
- ✅ Error logged to console
- ✅ Graceful degradation

---

## Test Scenario 4: Admin Bypass ✅

**Objective:** Verify that admin users bypass attendance checks completely.

### Prerequisites:
- Admin user exists in database
- Attendance API may or may not be running

### Test Steps:

1. **Login as Admin:**
   - Navigate to `/login`
   - Login with admin credentials
   - Should redirect to `/admin`

2. **Access Admin Routes:**
   - Navigate to `/admin/routes`
   - Should load successfully

3. **Verify Console Logs:**
   - Should NOT see any attendance check logs
   - Admin should bypass all attendance middleware

### Expected Results:
- ✅ Admin can access all routes
- ✅ No attendance checks performed
- ✅ No attendance banners shown
- ✅ Complete bypass

---

## Test Scenario 5: Cache Functionality ⚡

**Objective:** Verify that attendance status is cached and reduces API calls.

### Prerequisites:
- Attendance API is running
- `ATTENDANCE_STATUS_CACHE_DURATION=300` (5 minutes)

### Test Steps:

1. **First Request:**
   - Login as driver
   - Load dashboard
   - Verify API call made: `[Attendance] Fetching status from API`

2. **Second Request (within 5 minutes):**
   - Refresh dashboard
   - Verify cache used: `[Attendance] Using cached status`
   - No API call should be made

3. **Third Request (after 5 minutes):**
   - Wait 5+ minutes
   - Refresh dashboard
   - Verify new API call made

4. **Manual Refresh:**
   - Call `/api/driver/attendance/status?refresh=true`
   - Should bypass cache and fetch fresh data

### Expected Results:
- ✅ First request calls API
- ✅ Subsequent requests use cache (within TTL)
- ✅ Cache expires after 5 minutes
- ✅ Manual refresh bypasses cache
- ✅ Reduced API calls

---

## 📊 Test Results Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Driver Clocked In | ⏳ Pending | Requires attendance API setup |
| 2. Driver Not Clocked In | ⏳ Pending | Requires attendance API setup |
| 3. API Unavailable | ⏳ Pending | Can test immediately |
| 4. Admin Bypass | ⏳ Pending | Can test immediately |
| 5. Cache Functionality | ⏳ Pending | Requires attendance API setup |

---

## 🔧 Manual Testing Instructions

### Quick Test (No Attendance API Required):

1. **Test Admin Bypass:**
   ```bash
   # Login as admin
   # Navigate to /admin/routes
   # Verify no attendance checks in console
   ```

2. **Test Fallback Mode:**
   ```bash
   # Ensure ATTENDANCE_API_URL points to invalid endpoint
   # Login as driver
   # Verify fallback mode activates
   # Verify driver can still access routes
   ```

### Full Test (Requires Attendance API):

1. **Setup Mock Attendance API:**
   - Create simple Express server on port 4000
   - Implement `/api/attendance/status` endpoint
   - Return mock data based on test scenario

2. **Run All Scenarios:**
   - Follow test steps for each scenario
   - Document results
   - Verify expected behavior

---

## ✅ Acceptance Criteria

All scenarios must pass before moving to Phase 3:

- [ ] Driver clocked in can access routes with green banner
- [ ] Driver not clocked in sees warning but can access (permissive mode)
- [ ] API unavailable triggers fallback mode gracefully
- [ ] Admin users bypass all attendance checks
- [ ] Cache reduces API calls effectively
- [ ] No breaking changes to existing features
- [ ] Build completes successfully
- [ ] No TypeScript errors

---

## 🚀 Next Steps After Testing

Once all tests pass:
1. Document test results
2. Update Phase 2 summary with test outcomes
3. Proceed to Phase 3: Vehicle Management

