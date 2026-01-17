# Safari Login Issue - Quick Reference Card

**For Developers:** Copy-paste code snippets to fix the Safari re-login issue.

---

## 🚀 Quick Fix #1: Page Visibility API (RECOMMENDED)

**Add to:** `src/app/driver/stops/[id]/page.tsx`, `src/app/driver/stops/page.tsx`, `src/app/driver/documents/page.tsx`

```typescript
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      console.log('[Safari Fix] Tab became visible, checking token');
      
      const storedToken = sessionStorage.getItem("token") || localStorage.getItem("token");
      
      if (!storedToken) {
        console.warn('[Safari Fix] No token found, redirecting to login');
        router.push('/login');
        return;
      }
      
      // Refresh token proactively
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
            sessionStorage.setItem("token", data.token);
            localStorage.setItem("token", data.token);
            console.log('[Safari Fix] Token refreshed successfully');
          }
        } else {
          console.warn('[Safari Fix] Token refresh failed');
          router.push('/login');
        }
      } catch (error) {
        console.error('[Safari Fix] Error refreshing token:', error);
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [router]);
```

---

## 🚀 Quick Fix #2: Token Backup on Suspend

**Add to:** Same files as above

```typescript
useEffect(() => {
  const handleBeforeUnload = () => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("tokenBackup", token);
      localStorage.setItem("tokenTimestamp", Date.now().toString());
      console.log('[Safari Fix] Token backed up before suspend');
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

## 🚀 Quick Fix #3: Token Recovery

**Modify existing auth check in:** Same files as above

```typescript
useEffect(() => {
  try {
    let storedToken = sessionStorage.getItem("token");
    
    if (!storedToken) {
      storedToken = localStorage.getItem("token");
    }
    
    // NEW: Try to recover from backup
    if (!storedToken) {
      console.warn('[Safari Fix] Token not found, attempting recovery');
      storedToken = localStorage.getItem("tokenBackup");
      
      if (storedToken) {
        const timestamp = localStorage.getItem("tokenTimestamp");
        const tokenAge = Date.now() - parseInt(timestamp || "0");
        const maxAge = 12 * 60 * 60 * 1000; // 12 hours
        
        if (tokenAge < maxAge) {
          console.log('[Safari Fix] Token recovered from backup');
          sessionStorage.setItem("token", storedToken);
          localStorage.setItem("token", storedToken);
        } else {
          console.warn('[Safari Fix] Backup token expired');
          storedToken = null;
        }
      }
    }
    
    const userRole = sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
    
    if (!storedToken || userRole !== "DRIVER") {
      console.log("Authentication failed, redirecting to login");
      router.push("/login");
    } else {
      setToken(storedToken);
    }
  } catch (error) {
    console.error("Error checking authentication:", error);
    router.push("/login");
  }
}, [router]);
```

---

## 🧪 Testing Commands

```bash
# Test in Safari
open -a Safari http://localhost:3000/driver/stops

# Monitor console logs
# Look for: [Safari Fix] messages

# Test scenarios:
# 1. Click "View & Print" → Wait 2 min → Return to tab
# 2. Click "View & Print" → Wait 10 min → Return to tab
# 3. Lock phone → Unlock → Return to tab
```

---

## 📊 Files to Modify

1. ✅ `src/app/driver/stops/[id]/page.tsx` (Individual stop page)
2. ✅ `src/app/driver/stops/page.tsx` (All stops page)
3. ✅ `src/app/driver/documents/page.tsx` (Documents page)
4. ✅ `src/app/driver/page.tsx` (Dashboard)
5. ✅ `src/app/driver/routes/[id]/page.tsx` (Route details)

---

## ✅ Checklist

- [ ] Add Page Visibility API to all driver pages
- [ ] Add beforeunload handler to all driver pages
- [ ] Modify auth check to include token recovery
- [ ] Test on Safari iOS
- [ ] Test on Safari macOS
- [ ] Test on Chrome (regression)
- [ ] Monitor console logs for [Safari Fix] messages
- [ ] Verify no forced re-logins after viewing documents

---

## 🐛 Debugging

If still seeing re-login issues:

```typescript
// Add this to see what's happening:
console.log('Token check:', {
  sessionStorage: sessionStorage.getItem("token") ? 'EXISTS' : 'MISSING',
  localStorage: localStorage.getItem("token") ? 'EXISTS' : 'MISSING',
  tokenBackup: localStorage.getItem("tokenBackup") ? 'EXISTS' : 'MISSING',
  timestamp: localStorage.getItem("tokenTimestamp"),
  visibilityState: document.visibilityState,
});
```

---

## 📝 Notes

- All fixes are **non-breaking** and **backward compatible**
- Works on all browsers (not just Safari)
- Adds ~50 lines of code per page
- No UI changes needed
- No database changes needed
- No API changes needed (uses existing `/api/auth/refresh`)

---

## 🚨 Common Mistakes

❌ **Don't do this:**
```typescript
// This won't work - Safari clears localStorage
localStorage.setItem("token", token);
```

✅ **Do this instead:**
```typescript
// Use multiple storage locations + backup
sessionStorage.setItem("token", token);
localStorage.setItem("token", token);
localStorage.setItem("tokenBackup", token);
localStorage.setItem("tokenTimestamp", Date.now().toString());
```

---

## 💡 Pro Tips

1. **Always log with [Safari Fix] prefix** - Makes debugging easier
2. **Test on real devices** - Safari simulator behaves differently
3. **Check token age** - Don't recover tokens older than 12 hours
4. **Use visibilitychange** - More reliable than focus/blur events
5. **Add pagehide listener** - Safari-specific event for tab suspension

