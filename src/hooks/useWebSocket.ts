import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsServerEvent } from '../types';

export function useWebSocket(onEvent: (event: WsServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | undefined;
    let retryDelay = 1000;

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        setConnected(true);
        retryDelay = 1000;
      };

      socket.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as WsServerEvent;
          onEventRef.current(parsed);
        } catch (err) {
          console.error('Failed to parse WebSocket event:', err);
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimer = window.setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 8000);
          connect();
        }, retryDelay);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }, []);

  return { connected, sendMessage };
}
