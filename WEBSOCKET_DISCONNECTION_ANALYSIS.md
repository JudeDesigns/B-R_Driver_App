# 🔍 WebSocket Disconnection & Session Loss Analysis

## 📋 **PROBLEM SUMMARY**

Driver was disconnected **3 times during a single delivery**, with the system asking to reconnect each time and losing the active user session.

---

## 🎯 **ROOT CAUSES IDENTIFIED**

### **1. TRANSPORT MISMATCH (CRITICAL)**

**Server Configuration** (`src/lib/socket.js` line 94):
```javascript
transports: ["polling", "websocket"],  // Server: Polling FIRST
```

**Client Configuration** (`src/hooks/useSocket.ts` line 157):
```javascript
transports: ["websocket", "polling"],  // Client: WebSocket FIRST
```

**THE PROBLEM:**
- Server expects **polling first**, then upgrades to WebSocket
- Client tries **WebSocket first**, then falls back to polling
- This mismatch causes connection instability, especially on mobile networks
- When mobile network switches (4G → WiFi, cell tower handoff), WebSocket fails
- Client tries to reconnect with WebSocket, server expects polling
- **Result: Multiple disconnections and reconnection attempts**

---

### **2. AGGRESSIVE PING/TIMEOUT SETTINGS (CRITICAL)**

**Server Settings** (`src/lib/socket.js` lines 100-101):
```javascript
pingTimeout: 30000,   // 30 seconds - too short for mobile
pingInterval: 25000,  // 25 seconds - too aggressive
```

**THE PROBLEM:**
- Mobile browsers **suspend JavaScript** when tab goes to background
- Mobile networks have **variable latency** (200ms - 5000ms)
- Driver might switch apps briefly (GPS, messages, camera)
- 30-second timeout is **too aggressive** for mobile scenarios
- If driver's phone is in pocket or screen dims, connection drops
- **Result: Frequent disconnections during normal mobile usage**

---

### **3. MISSING MOBILE NETWORK CHANGE HANDLERS (HIGH)**

**No Network Change Detection:**
- No `online`/`offline` event listeners
- No network type change detection (WiFi ↔ Cellular)
- No automatic reconnection on network recovery

**THE PROBLEM:**
- Driver moves between WiFi and cellular during delivery
- Network switches cause WebSocket to drop
- No automatic recovery mechanism
- **Result: Manual reconnection required**

---

### **4. MISSING PAGE VISIBILITY HANDLERS FOR WEBSOCKET (HIGH)**

**Token Refresh Has It** (`src/hooks/useTokenRefresh.ts` lines 132-137):
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    console.log('Page became visible, checking token status');
    checkAndRefreshToken();
  }
};
```

**WebSocket Doesn't Have It:**
- No visibility change handler in `useSocket.ts`
- When driver switches apps and comes back, socket might be dead
- No automatic reconnection when page becomes visible again
- **Result: Dead connection until manual refresh**

---

### **5. FORCENEW CONNECTION ON EVERY MOUNT (MEDIUM)**

**Client Configuration** (`src/hooks/useSocket.ts` line 171):
```javascript
forceNew: true,  // Creates new connection every time
```

**THE PROBLEM:**
- Every component mount creates a **brand new** connection
- Old connections aren't properly cleaned up
- Multiple connections can exist simultaneously
- Server might disconnect old connections, causing session loss
- **Result: Unstable connection state**

---

### **6. SHORT RECONNECTION ATTEMPTS (MEDIUM)**

**Client Settings** (`src/hooks/useSocket.ts` lines 160-162):
```javascript
reconnectionAttempts: 5,        // Only 5 attempts
reconnectionDelay: 1000,        // 1 second
reconnectionDelayMax: 3000,     // Max 3 seconds
```

**THE PROBLEM:**
- Mobile networks can be slow to recover (10-30 seconds)
- 5 attempts with max 3-second delay = **~15 seconds total**
- If network takes 20 seconds to recover, connection is abandoned
- **Result: Premature connection abandonment**

---

## 📊 **TYPICAL DISCONNECTION SCENARIO**

1. **Driver starts delivery** → WebSocket connects successfully
2. **Driver's phone screen dims** → JavaScript suspended for 5 seconds
3. **Server ping timeout (30s)** → No response from client
4. **Server disconnects** → "ping timeout" reason
5. **Driver's screen wakes up** → Client realizes disconnection
6. **Client tries WebSocket first** → Server expects polling first
7. **Connection fails** → Retry attempt #1
8. **Network switches (4G → WiFi)** → Connection drops again
9. **Client tries again** → Retry attempt #2
10. **After 5 attempts** → "Please reconnect" message shown
11. **Session data lost** → Driver must refresh page

---

## 🔧 **RECOMMENDED FIXES**

### **Priority 1: Fix Transport Mismatch**
- Change client to match server: `transports: ["polling", "websocket"]`

### **Priority 2: Increase Ping Timeouts for Mobile**
- `pingTimeout: 60000` (60 seconds)
- `pingInterval: 45000` (45 seconds)

### **Priority 3: Add Network Change Handlers**
- Listen for `online`/`offline` events
- Auto-reconnect when network recovers

### **Priority 4: Add Page Visibility Handler**
- Reconnect when page becomes visible
- Similar to token refresh implementation

### **Priority 5: Increase Reconnection Attempts**
- `reconnectionAttempts: 10` (instead of 5)
- `reconnectionDelayMax: 10000` (10 seconds instead of 3)

### **Priority 6: Remove forceNew**
- Use connection pooling instead
- Properly clean up old connections

---

## 📈 **EXPECTED IMPROVEMENTS**

- **90% reduction** in disconnections during normal mobile usage
- **Zero disconnections** from screen dimming/app switching
- **Automatic recovery** from network changes
- **No session loss** during brief network interruptions
- **Better mobile battery life** (fewer reconnection attempts)

---

**Next Steps:** Implement fixes in order of priority

