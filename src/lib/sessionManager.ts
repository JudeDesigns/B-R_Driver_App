// Simple in-memory session invalidation system
// In production, you might want to use Redis or database storage

interface InvalidatedSession {
  userId: string;
  invalidatedAt: Date;
  reason: string;
}

class SessionManager {
  private invalidatedSessions: Map<string, InvalidatedSession> = new Map();
  
  // Invalidate all sessions for a user
  invalidateUserSessions(userId: string, reason: string = 'Password changed') {
    const sessionKey = `user:${userId}`;
    this.invalidatedSessions.set(sessionKey, {
      userId,
      invalidatedAt: new Date(),
      reason
    });
    
    console.log(`Invalidated all sessions for user ${userId}: ${reason}`);
  }
  
  // Check if user sessions are invalidated
  areUserSessionsInvalidated(userId: string): boolean {
    const sessionKey = `user:${userId}`;
    return this.invalidatedSessions.has(sessionKey);
  }
  
  // Get invalidation info
  getInvalidationInfo(userId: string): InvalidatedSession | null {
    const sessionKey = `user:${userId}`;
    return this.invalidatedSessions.get(sessionKey) || null;
  }
  
  // Clear invalidation (when user logs in again)
  clearUserInvalidation(userId: string) {
    const sessionKey = `user:${userId}`;
    this.invalidatedSessions.delete(sessionKey);
    console.log(`Cleared session invalidation for user ${userId}`);
  }
  
  // Cleanup old invalidations (older than 24 hours)
  cleanup() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [key, session] of this.invalidatedSessions.entries()) {
      if (session.invalidatedAt < oneDayAgo) {
        this.invalidatedSessions.delete(key);
      }
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Run cleanup every hour
if (typeof window === 'undefined') { // Only on server side
  setInterval(() => {
    sessionManager.cleanup();
  }, 60 * 60 * 1000); // 1 hour
}
