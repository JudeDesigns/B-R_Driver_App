/**
 * WebSocket Stability Test Suite
 * Tests the fixes for driver disconnection issues during deliveries
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocket } from '@/hooks/useSocket';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('WebSocket Stability Fixes', () => {
  let mockSocket: any;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    // Reset event handlers
    eventHandlers = {};

    // Create mock socket
    mockSocket = {
      connected: false,
      io: {
        opts: {
          transports: ['polling', 'websocket'],
        },
      },
      on: jest.fn((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(() => {
        mockSocket.connected = true;
        if (eventHandlers['connect']) {
          eventHandlers['connect']();
        }
      }),
      disconnect: jest.fn(() => {
        mockSocket.connected = false;
        if (eventHandlers['disconnect']) {
          eventHandlers['disconnect']('client disconnect');
        }
      }),
    };

    (io as jest.Mock).mockReturnValue(mockSocket);

    // Mock window events
    global.window = Object.create(window);
    global.document = Object.create(document);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fix 1: Transport Configuration Match', () => {
    it('should use polling first, then websocket (matching server)', () => {
      const { result } = renderHook(() => useSocket());

      // Verify io was called with correct transport order
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ['polling', 'websocket'], // Should match server
        })
      );
    });

    it('should NOT use websocket first (old buggy behavior)', () => {
      const { result } = renderHook(() => useSocket());

      // Verify it's NOT using the old incorrect order
      expect(io).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          transports: ['websocket', 'polling'], // Old incorrect order
        })
      );
    });
  });

  describe('Fix 2: Increased Reconnection Attempts', () => {
    it('should allow 10 reconnection attempts (not 5)', () => {
      const { result } = renderHook(() => useSocket());

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnectionAttempts: 10, // Increased from 5
        })
      );
    });

    it('should have 10 second max delay (not 3 seconds)', () => {
      const { result } = renderHook(() => useSocket());

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnectionDelayMax: 10000, // Increased from 3000
        })
      );
    });
  });

  describe('Fix 3: Connection Pooling (forceNew: false)', () => {
    it('should use connection pooling instead of forcing new connections', () => {
      const { result } = renderHook(() => useSocket());

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          forceNew: false, // Changed from true
        })
      );
    });
  });

  describe('Fix 4: Network Change Handlers', () => {
    it('should add online event listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      const { result } = renderHook(() => useSocket());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function)
      );
    });

    it('should add offline event listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      const { result } = renderHook(() => useSocket());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function)
      );
    });

    it('should reconnect when network comes back online', async () => {
      const { result } = renderHook(() => useSocket());

      // Simulate disconnect
      act(() => {
        if (eventHandlers['disconnect']) {
          eventHandlers['disconnect']('transport close');
        }
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      // Simulate network coming back online
      act(() => {
        const onlineEvent = new Event('online');
        window.dispatchEvent(onlineEvent);
      });

      // Should trigger reconnect
      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('Fix 5: Page Visibility Handler', () => {
    it('should add visibilitychange event listener', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      const { result } = renderHook(() => useSocket());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });

    it('should reconnect when page becomes visible after being hidden', async () => {
      const { result } = renderHook(() => useSocket());

      // Simulate disconnect while page was hidden
      act(() => {
        if (eventHandlers['disconnect']) {
          eventHandlers['disconnect']('ping timeout');
        }
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      // Simulate page becoming visible
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible',
      });

      act(() => {
        const visibilityEvent = new Event('visibilitychange');
        document.dispatchEvent(visibilityEvent);
      });

      // Should trigger reconnect
      await waitFor(() => {
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
    });
  });
});

