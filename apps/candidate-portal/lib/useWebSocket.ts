import { useEffect, useRef, useState } from "react";
import { env } from "./env";

export interface WSMessage {
  type: string;
  payload: any;
}

export function useWebSocket(onMessage?: (msg: WSMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
  // Store the callback in a ref so the socket never needs to reconnect
  // when the callback identity changes between renders.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const socket = new WebSocket(env.NEXT_PUBLIC_WEBSOCKET_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!cancelled) {
          console.log("WebSocket Connected");
          setIsConnected(true);
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          onMessageRef.current?.(msg);
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };

      socket.onclose = () => {
        if (!cancelled) {
          console.log("WebSocket Disconnected. Reconnecting in 3s...");
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        // Use warn instead of error to avoid triggering the Next.js dev overlay for transient blips
        console.warn("WebSocket connection attempt failed (URL: " + env.NEXT_PUBLIC_WEBSOCKET_URL + "). Will retry locally...");
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect on manual close
        socketRef.current.close();
      }
    };
  }, []); // Empty deps — connect once, stay connected

  return { isConnected };
}
