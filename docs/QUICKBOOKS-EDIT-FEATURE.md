# QuickBooks Invoice Number Edit Feature

## Overview
Added the ability for admins to edit the QuickBooks invoice number directly from the stop details page, similar to the existing driver reassignment functionality.

---

## Implementation Details

### **Files Modified**
1. `src/app/admin/stops/[id]/page.tsx` - Admin stop details page

### **Changes Made**

#### **1. State Management**
Added three new state variables to manage the QuickBooks edit functionality:

```typescript
// QuickBooks invoice number edit state
const [showQuickBooksEdit, setShowQuickBooksEdit] = useState(false);
const [quickBooksValue, setQuickBooksValue] = useState("");
const [updatingQuickBooks, setUpdatingQuickBooks] = useState(false);
```

#### **2. Update Handler Function**
Created `handleUpdateQuickBooks` function that:
- Validates authentication token
- Sends PUT request to `/api/admin/stops/[id]` endpoint
- Updates the `quickbooksInvoiceNum` field
- Refreshes stop details after successful update
- Handles errors gracefully

```typescript
const handleUpdateQuickBooks = async () => {
  if (!stop) return;

  setUpdatingQuickBooks(true);
  setError("");

  try {
    // Get authentication token
    let token = localStorage.getItem("token");
    if (!token) {
      token = sessionStorage.getItem("token");
    }

    if (!token) {
      router.push("/login");
      return;
    }

    // Send update request
    const response = await fetch(`/api/admin/stops/${stopId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        quickbooksInvoiceNum: quickBooksValue.trim() || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update QuickBooks invoice number");
    }

    // Refresh and reset
    await fetchStopDetails();
    setShowQuickBooksEdit(false);
    setQuickBooksValue("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "An error occurred");
  } finally {
    setUpdatingQuickBooks(false);
  }
};
```

#### **3. UI Implementation**
Replaced the static QuickBooks display with an interactive component:

**Display Mode:**
- Shows current QuickBooks invoice number (or "Not specified")
- "Change" button to enter edit mode

**Edit Mode:**
- Text input field pre-filled with current value
- "Save" button (disabled while saving)
- "Cancel" button to exit edit mode
- Input validation (trims whitespace, allows empty for null)

---

## User Experience

### **Before**
- QuickBooks invoice number was read-only
- No way to correct errors or add missing invoice numbers
- Required database access or route re-upload to fix

### **After**
- ✅ Click "Change" button next to QuickBooks number
- ✅ Edit the invoice number in the text field
- ✅ Click "Save" to update (or "Cancel" to discard)
- ✅ Instant feedback with loading state
- ✅ Automatic refresh to show updated value

---

## Technical Notes

### **API Endpoint Used**
- **Endpoint**: `PUT /api/admin/stops/[id]`
- **Existing**: The endpoint already supported updating `quickbooksInvoiceNum`
- **No API changes required**: Only frontend implementation needed

### **Permissions**
- Only accessible to ADMIN and SUPER_ADMIN roles
- Authentication token required
- Redirects to login if token is missing

### **Data Handling**
- Empty string is converted to `null` in database
- Whitespace is trimmed before saving
- Supports clearing the value (setting to null)

---

## Testing

### **Build Status**
✅ **Production build successful**
- No TypeScript errors
- No linting issues
- Bundle size: 9.33 kB for stop details page (minimal increase)

### **Test Scenarios**
1. ✅ Edit existing QuickBooks number
2. ✅ Add QuickBooks number when none exists
3. ✅ Clear QuickBooks number (set to null)
4. ✅ Cancel edit without saving
5. ✅ Handle authentication errors
6. ✅ Handle API errors gracefully

---

## UI Consistency

This feature follows the same pattern as the existing driver reassignment feature:
- Same visual design (inline edit with Save/Cancel buttons)
- Same interaction pattern (Change → Edit → Save/Cancel)
- Same error handling approach
- Same loading states and feedback

---

## Future Enhancements

Potential improvements for future iterations:
1. Add validation for invoice number format
2. Add confirmation dialog for changes
3. Add audit trail for invoice number changes
4. Add bulk edit capability for multiple stops
5. Add search/filter by QuickBooks invoice number

---

## Summary

**Feature**: Edit QuickBooks Invoice Number from Stop Details Page  
**Status**: ✅ COMPLETE  
**Build**: ✅ PASSING  
**Breaking Changes**: ❌ NONE  
**API Changes**: ❌ NONE (used existing endpoint)  
**Lines Added**: ~60 lines  
**Files Modified**: 1 file  

The feature is production-ready and follows existing patterns in the codebase.

