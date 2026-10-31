import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_MODE } from '../api/client.js';

const SOCKET_EVENTS = [
  'dashboard:update',
  'room:occupancy',
  'device:status',
  'sensor:data',
  'energy:data',
  'notification:new',
  'device:update',
  'mqtt-status',
];

export default function useRealtime(onEvent) {
  const socketRef = useRef(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (API_MODE !== 'real') return;

    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const token = localStorage.getItem('bo_token');
    const socket = io(url, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err.message);
      // Token tidak valid/kedaluwarsa: jangan mengulang tiap 2 detik (HTTP 401 akan mengarahkan ke login)
      if (err.message === 'unauthorized') socket.disconnect();
    });

    SOCKET_EVENTS.forEach((eventName) => {
      socket.on(eventName, (payload) => {
        handlerRef.current?.(eventName, payload);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
