# Safari Back Button Forces Re-Login Issue - Detailed Analysis

**Issue:** When a driver clicks on a document to view/print, it opens in a new tab. When they click the back button in Safari on the original tab, they are forced to log in again.

**Date:** 2026-01-16

---

## 🔍 Root Cause Analysis

### How Document Viewing Works

Based on the codebase analysis, here's what happens when a driver clicks "View & Print" on a document:

```typescript
// From src/app/driver/stops/[id]/page.tsx (lines 913-919)
<a
  href={doc.filePath}
  target="_blank"              // ← Opens in NEW TAB
  rel="noopener noreferrer"
  className="..."
>
  View & Print
</a>
```

**Key Points:**
1. ✅ Document opens in a **NEW TAB** (`target="_blank"`)
2. ✅ The original tab stays on the same page
3. ❌ **The driver should NOT need to use the back button** because they're still on the same page

---

## 🤔 Why Does Safari Force Re-Login on Back Button?

There are **4 possible reasons** why this happens:

### **Reason #1: Safari's Aggressive Cache Clearing (Most Likely)**

Safari on iOS/macOS has **aggressive privacy features** that clear page state when:
- The tab is inactive for a period of time
- Memory pressure occurs
- The user switches between many tabs

**What happens:**
1. Driver clicks "View & Print" → Document opens in new tab
2. Driver switches to new tab to view document
3. **Safari puts the original tab in "suspended" state**
4. Safari clears the page's JavaScript state (including `localStorage` token)
5. Driver closes document tab and returns to original tab
6. **Original tab reloads from scratch** (Safari's "page restoration")
7. Token is gone → Forced to re-login

**Evidence from code:**
```typescript
// From src/app/driver/stops/page.tsx (lines 92-124)
useEffect(() => {
  // Check both localStorage and sessionStorage
  let storedToken = sessionStorage.getItem("token");
  
  if (!storedToken) {
    storedToken = localStorage.getItem("token");
  }

  if (!storedToken || userRole !== "DRIVER") {
    console.log("Driver authentication failed, redirecting to login");
    router.push("/login");  // ← FORCED REDIRECT
  }
}, [router]);
```

**Safari's behavior:**
- When page is suspended/restored, `useEffect` runs again
- If token was cleared during suspension, `storedToken` is `null`
- Immediate redirect to `/login`

---

### **Reason #2: Token Expiration During Document Viewing**

Drivers have **12-hour token expiration**:

```typescript
// From src/app/api/auth/login/route.ts (line 66)
const tokenExpiry = userRole === "DRIVER" ? "12h" : "2h";
```

**Scenario:**
1. Driver logs in at 8:00 AM
2. Token expires at 8:00 PM
3. Driver views document at 7:55 PM (5 minutes before expiration)
4. Spends 10 minutes viewing/printing document
5. Returns to original tab at 8:05 PM
6. **Token is now expired** → Forced to re-login

**However:** This is less likely because:
- 12 hours is a long time
- Token refresh should handle this (see below)

---

### **Reason #3: Token Refresh Not Working in Background Tab**

The app has **automatic token refresh**:

```typescript
// From src/lib/tokenRefresh.ts (lines 176-184)
scheduleTokenRefresh(token: string): void {
  const timeUntilExpiry = this.getTimeUntilExpiry(token);
  const refreshIn = Math.max(0, (timeUntilExpiry - 120) * 1000);
  
  this.refreshTimer = setTimeout(() => {
    this.refreshToken();
  }, refreshIn);
}
```

**Problem:** Safari **throttles or suspends** JavaScript timers in background tabs:
- `setTimeout` may not fire when tab is inactive
- Token refresh scheduled for 11h 58m may never execute
- When driver returns, token is expired and refresh never happened

---

### **Reason #4: Safari's "Back-Forward Cache" (bfcache) Issue**

Safari uses **bfcache** (back-forward cache) to instantly restore pages when using back/forward buttons.

**How it works:**
1. When you navigate away, Safari **freezes** the page in memory
2. When you click back, Safari **restores** the frozen page
3. **Problem:** The frozen page may have stale authentication state

**What happens:**
1. Driver is on `/driver/stops/123`
2. Clicks document → Opens in new tab
3. Driver accidentally clicks a link in the original tab (navigates away)
4. Driver clicks back button
5. Safari restores the page from bfcache
6. **Auth state is stale** → Forced to re-login

---

## 📊 Most Likely Scenario

Based on the code and Safari's behavior, here's the **most likely sequence**:

1. **Driver is on `/driver/stops/123`**
   - Token stored in `localStorage` and `sessionStorage`
   - Page is active and authenticated

2. **Driver clicks "View & Print"**
   - Document opens in **new tab**
   - Original tab becomes **inactive/background**

3. **Safari suspends the original tab** (after ~30 seconds of inactivity)
   - JavaScript execution paused
   - Token refresh timer suspended
   - Page state frozen

4. **Driver spends time viewing/printing document** (2-5 minutes)
   - Original tab remains suspended

5. **Driver closes document tab or switches back**
   - Safari **restores** the original tab
   - Page **reloads** or **unfreezes**
   - `useEffect` runs again

6. **Authentication check fails**
   - **Scenario A:** Safari cleared `localStorage`/`sessionStorage` during suspension
   - **Scenario B:** Token expired while tab was suspended (no refresh happened)
   - **Scenario C:** Page state was corrupted during freeze/unfreeze

7. **Forced redirect to `/login`**

---

## 🔧 Why This Doesn't Happen in Chrome

Chrome handles background tabs differently:
- ✅ Less aggressive memory management
- ✅ Better preservation of `localStorage`/`sessionStorage`
- ✅ More reliable timer execution in background tabs
- ✅ Better bfcache implementation

Safari prioritizes:
- ❌ Battery life (aggressive tab suspension)
- ❌ Privacy (aggressive cache clearing)
- ❌ Memory management (aggressive state clearing)

---

## 🎯 The Real Question

**Wait, why is the driver using the back button at all?**

The document opens in a **NEW TAB** (`target="_blank"`), so:
- ✅ Original tab should still be on `/driver/stops/123`
- ✅ Driver should just **close the document tab** or **switch back**
- ❌ Driver should **NOT** need to use the back button

**Possible explanations:**
1. **Driver accidentally navigates** in the original tab while document is open
2. **Driver clicks back button out of habit** (even though they're on the same page)
3. **Safari auto-navigates** the original tab for some reason
4. **Driver is confused** about which tab they're on

---

## 📝 Summary

The issue is caused by **Safari's aggressive tab suspension and state clearing** combined with:
1. Token stored in `localStorage`/`sessionStorage` (volatile in Safari)
2. Token refresh timers suspended in background tabs
3. Authentication check on every page load/restore
4. No fallback mechanism when token is missing

**The driver shouldn't need to use the back button** because documents open in new tabs, but Safari's behavior makes the original tab lose its authentication state when it's suspended.

---

## 🔧 Recommended Solutions

See the companion document `SAFARI_BACK_BUTTON_FIX_RECOMMENDATIONS.md` for detailed solutions.

