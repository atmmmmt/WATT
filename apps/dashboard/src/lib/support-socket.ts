import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

export function createSupportSocket(token: string) {
  return io(`${API_BASE_URL}/support-realtime`, {
    // Allow polling fallback: websocket can be dropped by proxies / Cloudflare Tunnel,
    // which silently kills realtime. Polling keeps messages live even then.
    transports: ['websocket', 'polling'],
    // Aggressive, resilient reconnection so a brief drop or a server restart
    // reconnects fast instead of leaving the inbox stale until a manual refresh.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 10000,
    auth: {
      token,
    },
  });
}
