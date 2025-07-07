// Token refresh utility for maintaining long driver sessions
import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
  id: string;
  username: string;
  role: string;
  exp: number;
  iat: number;
}

class TokenManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  // Check if token is expired or will expire soon (within 5 minutes)
  isTokenExpiringSoon(token: string): boolean {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - currentTime;
      
      // Return true if token expires within 5 minutes (300 seconds)
      return timeUntilExpiry < 300;
    } catch (error) {
      console.error('Error decoding token:', error);
      return true; // Treat invalid tokens as expired
    }
  }

  // Check if token is completely expired
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      console.error('Error decoding token:', error);
      return true;
    }
  }

  // Get time until token expires (in seconds)
  getTimeUntilExpiry(token: string): number {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return Math.max(0, decoded.exp - currentTime);
    } catch (error) {
      return 0;
    }
  }

  // Refresh token by calling the refresh API
  async refreshToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    try {
      // Get current token from storage
      const currentToken = this.getCurrentToken();
      if (!currentToken) {
        console.log('No token found for refresh');
        return null;
      }

      // Call refresh API
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data.token;

        if (newToken) {
          // Update token in storage
          this.updateTokenInStorage(newToken);
          console.log('Token refreshed successfully');
          
          // Schedule next refresh
          this.scheduleTokenRefresh(newToken);
          
          return newToken;
        }
      } else {
        console.error('Token refresh failed:', response.status);
        // If refresh fails, redirect to login
        this.handleRefreshFailure();
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.handleRefreshFailure();
    }

    return null;
  }

  // Get current token from storage (check both sessionStorage and localStorage)
  private getCurrentToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    return sessionStorage.getItem('token') || localStorage.getItem('token');
  }

  // Update token in the same storage location it was found
  private updateTokenInStorage(newToken: string): void {
    if (typeof window === 'undefined') return;

    // Update in both storages to ensure consistency
    if (sessionStorage.getItem('token')) {
      sessionStorage.setItem('token', newToken);
    }
    if (localStorage.getItem('token')) {
      localStorage.setItem('token', newToken);
    }
  }

  // Handle refresh failure by redirecting to login
  private handleRefreshFailure(): void {
    console.log('Token refresh failed, redirecting to login');
    
    // Clear tokens
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('token');
      localStorage.removeItem('token');
      sessionStorage.removeItem('userRole');
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('userId');
      localStorage.removeItem('userId');
      sessionStorage.removeItem('username');
      localStorage.removeItem('username');
    }

    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  // Schedule automatic token refresh
  scheduleTokenRefresh(token: string): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    
    // Schedule refresh 2 minutes before expiry (or immediately if less than 2 minutes left)
    const refreshIn = Math.max(0, (timeUntilExpiry - 120) * 1000);
    
    console.log(`Scheduling token refresh in ${Math.floor(refreshIn / 1000)} seconds`);
    
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, refreshIn);
  }

  // Start automatic token refresh for the current session
  startAutoRefresh(): void {
    const token = this.getCurrentToken();
    if (token && !this.isTokenExpired(token)) {
      this.scheduleTokenRefresh(token);
    }
  }

  // Stop automatic token refresh
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Check and refresh token if needed (for manual calls)
  async ensureValidToken(): Promise<string | null> {
    const token = this.getCurrentToken();
    
    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      console.log('Token is expired, attempting refresh');
      return await this.refreshToken();
    }

    if (this.isTokenExpiringSoon(token)) {
      console.log('Token is expiring soon, refreshing proactively');
      return await this.refreshToken();
    }

    return token;
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();

// Export utility functions
export const {
  isTokenExpired,
  isTokenExpiringSoon,
  refreshToken,
  scheduleTokenRefresh,
  startAutoRefresh,
  stopAutoRefresh,
  ensureValidToken,
} = tokenManager;
