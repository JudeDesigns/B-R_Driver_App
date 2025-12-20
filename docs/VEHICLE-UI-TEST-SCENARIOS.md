# Vehicle Management UI - Test Scenarios

**Date:** 2025-11-20  
**Status:** Ready for Testing  
**Build Status:** ✅ PASSING

---

## 📋 Test Overview

This document outlines comprehensive test scenarios for the Vehicle Management UI implementation.

---

## ✅ Pre-Test Checklist

- [x] Build completed successfully
- [x] All vehicle pages created
- [x] Sidebar navigation updated
- [x] API endpoints verified (Phase 3)
- [x] Database models synced (Phase 1)
- [x] No TypeScript errors
- [x] No conflicts detected

---

## 🧪 Test Scenarios

### **Scenario 1: Access Vehicle Management Page**

**Objective:** Verify vehicle list page loads correctly

**Steps:**
1. Login as Admin or Super Admin
2. Navigate to sidebar
3. Click "Vehicle Management" menu item
4. Verify page loads

**Expected Results:**
- ✅ Vehicle Management page loads
- ✅ "Add New Vehicle" button visible
- ✅ Search and filter controls visible
- ✅ Empty state message if no vehicles
- ✅ Table with columns: Vehicle Number, Make, Model, Year, License Plate, Status, Assignments, Actions

**Test Data:**
```bash
# Login credentials
Username: Administrator
Password: Administrator
```

---

### **Scenario 2: Create New Vehicle**

**Objective:** Test vehicle creation flow

**Steps:**
1. Navigate to Vehicle Management page
2. Click "Add New Vehicle" button
3. Fill in form:
   - Vehicle Number: "V001" (required)
   - Make: "Ford"
   - Model: "F-150"
   - Year: "2020"
   - License Plate: "ABC-1234"
   - VIN: "1FTFW1E84MFA12345"
   - Fuel Type: "DIESEL"
   - Status: "ACTIVE"
   - Notes: "Test vehicle for delivery routes"
4. Click "Create Vehicle"

**Expected Results:**
- ✅ Form validates required fields
- ✅ Vehicle created successfully
- ✅ Redirected to vehicle details page
- ✅ Success message displayed
- ✅ All entered data visible on details page

**API Endpoint:** `POST /api/admin/vehicles`

---

### **Scenario 3: View Vehicle Details**

**Objective:** Verify vehicle details page displays correctly

**Steps:**
1. Navigate to Vehicle Management page
2. Click on a vehicle number link or "View" button
3. Verify details page loads

**Expected Results:**
- ✅ Vehicle information section displays all fields
- ✅ Status badge shows correct color
- ✅ Assignment history section visible
- ✅ "Edit Vehicle" button visible
- ✅ "Delete" button visible
- ✅ "Back to Vehicles" link works

**API Endpoint:** `GET /api/admin/vehicles/[id]`

---

### **Scenario 4: Edit Vehicle**

**Objective:** Test vehicle update functionality

**Steps:**
1. Navigate to vehicle details page
2. Click "Edit Vehicle" button
3. Modify fields:
   - Status: Change to "MAINTENANCE"
   - Notes: Add "Scheduled maintenance on 2025-11-25"
4. Click "Save Changes"

**Expected Results:**
- ✅ Edit form pre-populated with current data
- ✅ Changes saved successfully
- ✅ Redirected to vehicle details page
- ✅ Updated data visible
- ✅ Success message displayed

**API Endpoint:** `PUT /api/admin/vehicles/[id]`

---

### **Scenario 5: Search and Filter Vehicles**

**Objective:** Test search and filter functionality

**Steps:**
1. Navigate to Vehicle Management page
2. Test search:
   - Enter "Ford" in search box
   - Verify filtered results
3. Test status filter:
   - Select "ACTIVE" from status dropdown
   - Verify filtered results
4. Test pagination:
   - Change items per page to 25
   - Verify pagination updates

**Expected Results:**
- ✅ Search filters by vehicle number, make, model
- ✅ Status filter works correctly
- ✅ Pagination controls work
- ✅ Results update without page reload
- ✅ Filters can be combined

**API Endpoint:** `GET /api/admin/vehicles?search=...&status=...`

---

### **Scenario 6: Delete Vehicle**

**Objective:** Test vehicle deletion (soft delete)

**Steps:**
1. Navigate to vehicle details page
2. Click "Delete" button
3. Verify confirmation modal appears
4. Click "Delete" in modal

**Expected Results:**
- ✅ Confirmation modal displays
- ✅ Vehicle number shown in confirmation
- ✅ "Cancel" button works
- ✅ "Delete" button triggers deletion
- ✅ Redirected to vehicle list
- ✅ Vehicle no longer visible in list
- ✅ Database record has isDeleted=true (soft delete)

**API Endpoint:** `DELETE /api/admin/vehicles/[id]`

**Note:** If PASSWORD_CONFIRMATION_ENABLED=true, password will be required

---

### **Scenario 7: View Assignment History**

**Objective:** Verify assignment history displays correctly

**Prerequisites:** Create vehicle assignment first

**Steps:**
1. Create a vehicle assignment via API or route upload
2. Navigate to vehicle details page
3. Scroll to "Assignment History" section

**Expected Results:**
- ✅ Assignment history table visible
- ✅ Shows: Date, Driver, Route, Status
- ✅ Route number is clickable link
- ✅ Driver name displays correctly
- ✅ Status badge shows correct color
- ✅ Empty state if no assignments

**Related Models:** VehicleAssignment

---

### **Scenario 8: Sidebar Navigation**

**Objective:** Test sidebar integration

**Steps:**
1. Login as Admin
2. Open sidebar menu
3. Locate "Vehicle Management" item
4. Click menu item
5. Verify active state

**Expected Results:**
- ✅ "Vehicle Management" menu item visible
- ✅ Positioned after "Products"
- ✅ Orange truck icon visible
- ✅ Active state highlights correctly
- ✅ Orange left border when active
- ✅ Hover effects work

---

### **Scenario 9: Feature Flag Test**

**Objective:** Verify feature flag controls access

**Steps:**
1. Set `NEXT_PUBLIC_VEHICLE_MANAGEMENT_ENABLED=false` in `.env`
2. Restart application
3. Navigate to `/admin/vehicles`

**Expected Results:**
- ✅ Disabled message displays
- ✅ No vehicle data shown
- ✅ Instructions to enable feature

**Steps to Re-enable:**
1. Set `NEXT_PUBLIC_VEHICLE_MANAGEMENT_ENABLED=true`
2. Restart application
3. Verify full functionality restored

---

### **Scenario 10: Responsive Design**

**Objective:** Test mobile responsiveness

**Steps:**
1. Open vehicle management page
2. Resize browser to mobile width (375px)
3. Test all interactions

**Expected Results:**
- ✅ Layout adapts to mobile
- ✅ Search/filter controls stack vertically
- ✅ Table scrolls horizontally if needed
- ✅ Buttons remain accessible
- ✅ Forms are mobile-friendly
- ✅ Sidebar hamburger menu works

---

## 🔗 Integration Tests

### **Test 1: Vehicle Assignment to Route**

**Objective:** Verify vehicle can be assigned to routes

**Steps:**
1. Create a vehicle (V001)
2. Create a route via upload
3. Assign vehicle to route via API
4. View vehicle details
5. Verify assignment appears in history

**API Endpoint:** `POST /api/admin/vehicle-assignments`

---

### **Test 2: Driver Route Query with Vehicle**

**Objective:** Verify driver can access routes via vehicle assignment

**Steps:**
1. Create vehicle assignment for driver
2. Login as driver
3. Navigate to driver dashboard
4. Verify assigned routes appear

**Expected Results:**
- ✅ Routes assigned via vehicle visible
- ✅ Routes assigned directly visible
- ✅ Routes assigned via stop visible
- ✅ OR logic working correctly

**API Endpoint:** `GET /api/driver/assigned-routes`

---

## 📊 Test Results Template

```markdown
## Test Execution Results

**Date:** [Date]
**Tester:** [Name]
**Environment:** [Local/Production]

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Access Vehicle Management | ⏳ | |
| 2. Create New Vehicle | ⏳ | |
| 3. View Vehicle Details | ⏳ | |
| 4. Edit Vehicle | ⏳ | |
| 5. Search and Filter | ⏳ | |
| 6. Delete Vehicle | ⏳ | |
| 7. Assignment History | ⏳ | |
| 8. Sidebar Navigation | ⏳ | |
| 9. Feature Flag | ⏳ | |
| 10. Responsive Design | ⏳ | |
| Integration Test 1 | ⏳ | |
| Integration Test 2 | ⏳ | |

**Legend:**
- ⏳ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed
```

---

## 🐛 Known Issues

None identified during implementation.

---

## 📝 Notes

- All tests assume `VEHICLE_MANAGEMENT_ENABLED=true`
- Password confirmation tests require `PASSWORD_CONFIRMATION_ENABLED=true`
- Integration tests require database with test data
- Mobile tests require browser dev tools or physical device

---

**Test scenarios ready for execution!** 🚀

