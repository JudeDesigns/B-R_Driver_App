"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { tokenManager } from '@/lib/tokenRefresh';

interface UseTokenRefreshOptions {
  enabled?: boolean;
  onTokenRefreshed?: (newToken: string) => void;
  onRefreshFailed?: () => void;
}

export const useTokenRefresh = (options: UseTokenRefreshOptions = {}) => {
  const { enabled = true, onTokenRefreshed, onRefreshFailed } = options;
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check token status and refresh if needed
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const currentToken = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('token') || localStorage.getItem('token'))
        : null;

      if (!currentToken) {
        console.log('No token found, stopping auto-refresh');
        return false;
      }

      // Check if token is expired or expiring soon
      if (tokenManager.isTokenExpired(currentToken)) {
        console.log('Token is expired, attempting refresh');
        const newToken = await tokenManager.refreshToken();
        
        if (newToken) {
          onTokenRefreshed?.(newToken);
          return true;
        } else {
          console.log('Token refresh failed, redirecting to login');
          onRefreshFailed?.();
          router.push('/login');
          return false;
        }
      } else if (tokenManager.isTokenExpiringSoon(currentToken)) {
        console.log('Token is expiring soon, refreshing proactively');
        const newToken = await tokenManager.refreshToken();
        
        if (newToken) {
          onTokenRefreshed?.(newToken);
          return true;
        }
        // If refresh fails but token is still valid, continue
        return true;
      }

      return true; // Token is still valid
    } catch (error) {
      console.error('Error in token refresh check:', error);
      return false;
    }
  }, [router, onTokenRefreshed, onRefreshFailed]);

  // Start automatic token refresh
  const startAutoRefresh = useCallback(() => {
    if (!enabled) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Check immediately
    checkAndRefreshToken();

    // Set up periodic checks every 2 minutes
    intervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 2 * 60 * 1000); // 2 minutes

    console.log('Auto token refresh started (checking every 2 minutes)');
  }, [enabled, checkAndRefreshToken]);

  // Stop automatic token refresh
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('Auto token refresh stopped');
    }
  }, []);

  // Manual token refresh
  const manualRefresh = useCallback(async () => {
    try {
      const newToken = await tokenManager.refreshToken();
      if (newToken) {
        onTokenRefreshed?.(newToken);
        return newToken;
      } else {
        onRefreshFailed?.();
        router.push('/login');
        return null;
      }
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      onRefreshFailed?.();
      return null;
    }
  }, [router, onTokenRefreshed, onRefreshFailed]);

  // Get current token with automatic refresh if needed
  const getValidToken = useCallback(async () => {
    return await tokenManager.ensureValidToken();
  }, []);

  // Initialize auto-refresh on mount
  useEffect(() => {
    if (enabled) {
      startAutoRefresh();
    }

    // Cleanup on unmount
    return () => {
      stopAutoRefresh();
    };
  }, [enabled, startAutoRefresh, stopAutoRefresh]);

  // Handle page visibility changes (refresh when page becomes visible)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, checking token status');
        checkAndRefreshToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkAndRefreshToken]);

  // Handle focus events (refresh when window gains focus)
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      console.log('Window gained focus, checking token status');
      checkAndRefreshToken();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, checkAndRefreshToken]);

  return {
    startAutoRefresh,
    stopAutoRefresh,
    manualRefresh,
    getValidToken,
    checkAndRefreshToken,
  };
};
