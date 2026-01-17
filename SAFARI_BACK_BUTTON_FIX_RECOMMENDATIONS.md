# Safari Back Button Login Issue - Fix Recommendations

**Related:** `SAFARI_BACK_BUTTON_LOGIN_ISSUE_ANALYSIS.md`

---

## 🎯 Quick Fixes (Immediate Implementation)

### **Fix #1: Add Page Visibility API to Refresh Token on Tab Focus**

When the driver returns to the original tab, automatically refresh the token.

**Implementation:**

```typescript
// Add to src/app/driver/stops/[id]/page.tsx

useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible, checking token validity');
      
      // Check if token exists and is valid
      const storedToken = sessionStorage.getItem("token") || localStorage.getItem("token");
      
      if (!storedToken) {
        console.warn('No token found after tab became visible');
        router.push('/login');
        return;
      }
      
      // Try to refresh token proactively
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            // Update token in storage
            sessionStorage.setItem("token", data.token);
            localStorage.setItem("token", data.token);
            console.log('Token refreshed successfully on tab focus');
          }
        } else {
          console.warn('Token refresh failed, redirecting to login');
          router.push('/login');
        }
      } catch (error) {
        console.error('Error refreshing token on tab focus:', error);
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [router]);
```

**Benefits:**
- ✅ Automatically refreshes token when driver returns to tab
- ✅ Prevents forced re-login
- ✅ Works across all browsers
- ✅ No UI changes needed

---

### **Fix #2: Add "beforeunload" Event to Persist Token**

Ensure token is saved before Safari suspends the tab.

```typescript
// Add to src/app/driver/stops/[id]/page.tsx

useEffect(() => {
  const handleBeforeUnload = () => {
    // Ensure token is persisted before page unload/suspension
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("tokenBackup", token);
      localStorage.setItem("tokenTimestamp", Date.now().toString());
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handleBeforeUnload); // Safari-specific
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handleBeforeUnload);
  };
}, []);
```

---

### **Fix #3: Add Token Recovery Mechanism**

If token is missing, try to recover from backup before forcing re-login.

```typescript
// Modify the auth check in src/app/driver/stops/[id]/page.tsx

useEffect(() => {
  try {
    let storedToken = sessionStorage.getItem("token");
    
    if (!storedToken) {
      storedToken = localStorage.getItem("token");
    }
    
    // NEW: Try to recover from backup
    if (!storedToken) {
      console.warn('Token not found, attempting recovery from backup');
      storedToken = localStorage.getItem("tokenBackup");
      
      if (storedToken) {
        // Check if backup token is recent (within last 12 hours)
        const timestamp = localStorage.getItem("tokenTimestamp");
        const tokenAge = Date.now() - parseInt(timestamp || "0");
        const maxAge = 12 * 60 * 60 * 1000; // 12 hours
        
        if (tokenAge < maxAge) {
          console.log('Recovered token from backup');
          sessionStorage.setItem("token", storedToken);
          localStorage.setItem("token", storedToken);
        } else {
          console.warn('Backup token is too old, forcing re-login');
          storedToken = null;
        }
      }
    }
    
    if (!storedToken || userRole !== "DRIVER") {
      console.log("Driver authentication failed, redirecting to login");
      router.push("/login");
    } else {
      setToken(storedToken);
    }
  } catch (error) {
    console.error("Error checking driver authentication:", error);
    router.push("/login");
  }
}, [router]);
```

---

## 🔧 Medium-Term Fixes (1-2 Weeks)

### **Fix #4: Implement Service Worker for Token Persistence**

Use a Service Worker to maintain token state even when tab is suspended.

**Benefits:**
- ✅ Token persists across tab suspensions
- ✅ Works offline
- ✅ More reliable than localStorage in Safari

**Implementation:** (Requires separate Service Worker setup)

---

### **Fix #5: Add "Keep-Alive" Ping for Active Sessions**

Send periodic pings to keep the session alive while driver is viewing documents.

```typescript
// Add to src/app/driver/stops/[id]/page.tsx

useEffect(() => {
  let keepAliveInterval: NodeJS.Timeout;
  
  const startKeepAlive = () => {
    keepAliveInterval = setInterval(async () => {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      
      if (token) {
        try {
          // Ping the server to keep session alive
          await fetch('/api/auth/keep-alive', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          console.log('Keep-alive ping sent');
        } catch (error) {
          console.error('Keep-alive ping failed:', error);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  };
  
  startKeepAlive();
  
  return () => {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
  };
}, []);
```

**Note:** Need to create `/api/auth/keep-alive` endpoint.

---

## 🚀 Long-Term Fixes (1+ Month)

### **Fix #6: Implement HTTP-Only Cookies for Authentication**

Replace localStorage/sessionStorage with HTTP-only cookies.

**Benefits:**
- ✅ More secure (XSS-proof)
- ✅ Automatically sent with every request
- ✅ Not affected by Safari's localStorage clearing
- ✅ Persists across tab suspensions

**Drawbacks:**
- ❌ Requires significant refactoring
- ❌ Need to update all API calls
- ❌ CSRF protection needed

---

### **Fix #7: Add "Session Recovery" UI**

Instead of forcing re-login, show a "Session Expired - Tap to Refresh" message.

```typescript
// Add to src/app/driver/stops/[id]/page.tsx

const [sessionExpired, setSessionExpired] = useState(false);

const handleSessionRefresh = async () => {
  // Try to refresh token
  const refreshed = await attemptTokenRefresh();
  
  if (refreshed) {
    setSessionExpired(false);
    // Reload page data
    fetchStopDetails();
  } else {
    router.push('/login');
  }
};

// In render:
{sessionExpired && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm">
      <h3 className="text-lg font-bold mb-2">Session Expired</h3>
      <p className="text-gray-600 mb-4">
        Your session has expired. Tap below to refresh and continue.
      </p>
      <button
        onClick={handleSessionRefresh}
        className="w-full bg-blue-600 text-white py-3 rounded-lg"
      >
        Refresh Session
      </button>
    </div>
  </div>
)}
```

---

## 📊 Recommended Implementation Order

1. **Immediate (Today):**
   - ✅ Fix #1: Page Visibility API
   - ✅ Fix #2: beforeunload Event
   - ✅ Fix #3: Token Recovery

2. **This Week:**
   - ✅ Fix #5: Keep-Alive Ping
   - ✅ Fix #7: Session Recovery UI

3. **Next Month:**
   - ✅ Fix #4: Service Worker
   - ✅ Fix #6: HTTP-Only Cookies (if needed)

---

## 🧪 Testing Checklist

After implementing fixes, test:

- [ ] Open document in new tab, wait 2 minutes, switch back
- [ ] Open document in new tab, wait 10 minutes, switch back
- [ ] Open multiple documents in multiple tabs
- [ ] Lock phone while viewing document, unlock and switch back
- [ ] Switch to another app while viewing document, switch back
- [ ] Test on Safari iOS (iPhone/iPad)
- [ ] Test on Safari macOS
- [ ] Test on Chrome (should still work)
- [ ] Test with slow network connection
- [ ] Test with airplane mode (offline)

---

## 📝 Notes

- Safari's behavior is **intentional** for privacy/battery life
- Cannot completely prevent Safari from suspending tabs
- Best approach: **Gracefully handle** suspension/restoration
- Focus on **token recovery** rather than prevention

