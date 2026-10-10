import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function createClassroomSocket({ classroomId, token, participantToken }) {
  const socket = io(SOCKET_URL, {
    auth: {
      classroomId,
      token,
      participantToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log(`🔌 [Socket.io] Connected to classroom: ${classroomId}`);
  });

  socket.on('connect_error', (err) => {
    console.warn(`⚠️ [Socket.io] Connection error:`, err.message);
  });

  return socket;
}
