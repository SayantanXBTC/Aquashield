import { useEffect, useRef } from "react";
import { getAccessToken } from "@/features/auth/tokenProvider";
import type { AIEvent } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function socketUrl(token: string | null): string {
  const base = API_URL.replace(/^http/, "ws");
  return token ? `${base}/ws/ai?token=${encodeURIComponent(token)}` : `${base}/ws/ai`;
}

/**
 * The live view of the analysis graph (`/ws/ai`).
 *
 * Milestones are a progress indicator only — the Command Brief itself always
 * arrives over HTTP, so a dropped socket degrades the HUD's liveness and
 * nothing else. The socket reconnects with backoff and is torn down on
 * unmount; `enabled` false closes it (no analysis to watch, nothing to hold
 * open).
 */
export function useAIEvents(enabled: boolean, onEvent: (event: AIEvent) => void): void {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let delay = RECONNECT_MIN_MS;
    let disposed = false;

    const connect = async () => {
      if (disposed) return;
      const token = await getAccessToken();
      if (disposed) return;
      socket = new WebSocket(socketUrl(token));
      socket.onopen = () => {
        delay = RECONNECT_MIN_MS;
      };
      socket.onmessage = (message) => {
        try {
          handler.current(JSON.parse(message.data as string) as AIEvent);
        } catch {
          // A malformed frame is dropped: the brief is fetched over HTTP.
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        retryTimer = window.setTimeout(() => void connect(), delay);
        delay = Math.min(RECONNECT_MAX_MS, delay * 2);
      };
    };

    void connect();

    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [enabled]);
}
