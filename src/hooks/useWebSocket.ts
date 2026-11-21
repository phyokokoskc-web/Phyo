import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsServerEvent } from '../types';

export function useWebSocket(
  onEvent: (event: WsServerEvent) => void,
  onReconnect?: () => void
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let retryDelay = 1000;
    let hasConnectedOnce = false;

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
        if (hasConnectedOnce) {
          onReconnectRef.current?.();
        }
        hasConnectedOnce = true;

        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      socket.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data) as WsServerEvent | { type: 'pong' };
          if ((parsed as { type: string }).type === 'pong') return;
          onEventRef.current(parsed as WsServerEvent);
        } catch (err) {
          console.error('Failed to parse WebSocket event:', err);
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setConnected(false);
        wsRef.current = null;
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = undefined;
        }
        reconnectTimer = window.setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 6000);
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
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
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
